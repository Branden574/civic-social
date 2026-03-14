'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — Performance Instrumentation
// ═══════════════════════════════════════════════════════════════
//
// Tracks: cold start, time-to-first-content, API latency (p50/p95),
// JS blocking time, and provides a dev-only performance panel.
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useRef, useState, useCallback, memo } from 'react';

// ─── Types ───────────────────────────────────────────────────

interface ApiTiming {
  url: string;
  method: string;
  durationMs: number;
  status: number;
  timestamp: number;
}

interface PerfMetrics {
  coldStartMs: number | null;
  firstContentMs: number | null;
  apiTimings: ApiTiming[];
  navigationStart: number;
}

interface PerfContextValue {
  metrics: PerfMetrics;
  markFirstContent: () => void;
  trackApi: (url: string, method: string, durationMs: number, status: number) => void;
}

// ─── Constants ───────────────────────────────────────────────

const APP_START = typeof performance !== 'undefined' ? performance.now() : Date.now();
const MAX_API_HISTORY = 50;

// ─── Context ─────────────────────────────────────────────────

const PerfContext = createContext<PerfContextValue>({
  metrics: { coldStartMs: null, firstContentMs: null, apiTimings: [], navigationStart: APP_START },
  markFirstContent: () => {},
  trackApi: () => {},
});

export function usePerf() {
  return useContext(PerfContext);
}

// ─── Provider ────────────────────────────────────────────────

export function PerfProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<PerfMetrics>({
    coldStartMs: null,
    firstContentMs: null,
    apiTimings: [],
    navigationStart: APP_START,
  });
  const firstContentMarked = useRef(false);

  // Measure cold start (time from navigation start to interactive)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measureColdStart = () => {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        const coldStart = nav.domInteractive - nav.startTime;
        setMetrics((prev) => ({ ...prev, coldStartMs: Math.round(coldStart) }));
      }
    };

    // Wait for load to complete
    if (document.readyState === 'complete') {
      measureColdStart();
    } else {
      window.addEventListener('load', measureColdStart, { once: true });
    }
  }, []);

  const markFirstContent = useCallback(() => {
    if (firstContentMarked.current) return;
    firstContentMarked.current = true;
    const elapsed = performance.now() - APP_START;
    setMetrics((prev) => ({ ...prev, firstContentMs: Math.round(elapsed) }));
  }, []);

  const trackApi = useCallback((url: string, method: string, durationMs: number, status: number) => {
    setMetrics((prev) => ({
      ...prev,
      apiTimings: [
        { url, method, durationMs: Math.round(durationMs), status, timestamp: Date.now() },
        ...prev.apiTimings,
      ].slice(0, MAX_API_HISTORY),
    }));
  }, []);

  return (
    <PerfContext.Provider value={{ metrics, markFirstContent, trackApi }}>
      {children}
    </PerfContext.Provider>
  );
}

// ─── Instrumented fetch wrapper ──────────────────────────────

export function useTrackedFetch() {
  const { trackApi } = usePerf();

  return useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const start = performance.now();
    const method = options?.method || 'GET';

    try {
      const response = await fetch(url, options);
      const duration = performance.now() - start;
      trackApi(url, method, duration, response.status);
      return response;
    } catch (err) {
      const duration = performance.now() - start;
      trackApi(url, method, duration, 0);
      throw err;
    }
  }, [trackApi]);
}

// ─── Performance Debug Panel (dev-only) ──────────────────────

export const PerfPanel = memo(function PerfPanel() {
  const { metrics } = usePerf();
  const [visible, setVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') return null;

  const apiP50 = getPercentile(metrics.apiTimings.map((t) => t.durationMs), 50);
  const apiP95 = getPercentile(metrics.apiTimings.map((t) => t.durationMs), 95);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setVisible(!visible)}
        className="fixed bottom-4 left-4 z-[9999] w-8 h-8 rounded-full bg-civic text-white text-xs font-bold flex items-center justify-center shadow-lg hover:bg-civic-dark transition-colors"
        title="Performance Panel"
      >
        P
      </button>

      {visible && (
        <div className="fixed bottom-14 left-4 z-[9999] w-80 max-h-96 overflow-y-auto bg-[#0A0B0F] border border-border-subtle rounded-xl shadow-2xl p-4 text-xs font-mono">
          <h3 className="text-civic-light font-bold text-sm mb-3">Performance</h3>

          <div className="space-y-2 mb-4">
            <MetricRow label="Cold Start" value={metrics.coldStartMs} unit="ms" budget={2000} />
            <MetricRow label="First Content" value={metrics.firstContentMs} unit="ms" budget={1500} />
            <MetricRow label="API p50" value={apiP50} unit="ms" budget={300} />
            <MetricRow label="API p95" value={apiP95} unit="ms" budget={800} />
            <MetricRow label="API Calls" value={metrics.apiTimings.length} unit="" budget={null} />
          </div>

          <h4 className="text-text-muted font-bold mb-2">Recent API Calls</h4>
          <div className="space-y-1">
            {metrics.apiTimings.slice(0, 10).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={t.status >= 400 ? 'text-danger-light' : 'text-positive-light'}>
                  {t.status || 'ERR'}
                </span>
                <span className="text-text-muted truncate flex-1">{t.url.split('?')[0]}</span>
                <span className={t.durationMs > 500 ? 'text-warning-light' : 'text-text-secondary'}>
                  {t.durationMs}ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
});

function MetricRow({ label, value, unit, budget }: {
  label: string;
  value: number | null;
  unit: string;
  budget: number | null;
}) {
  const overBudget = budget !== null && value !== null && value > budget;
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={overBudget ? 'text-danger-light font-bold' : 'text-text-primary'}>
        {value !== null ? `${value}${unit}` : '—'}
        {budget !== null && (
          <span className="text-text-muted ml-1">/ {budget}{unit}</span>
        )}
      </span>
    </div>
  );
}

function getPercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
