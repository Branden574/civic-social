'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  Database,
  Zap,
  XCircle,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import type { ApiHealth, SyncLogEntry } from '@/lib/legislation/types';

// ═══════════════════════════════════════════════════════════════
// Admin: Legislation Sync Health Dashboard (wrapped by admin layout)
// ═══════════════════════════════════════════════════════════════

export default function AdminLegislationPage() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/legislation?health=1&synclog=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data.health);
      setSyncLog(data.syncLog || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const mismatchEvents = syncLog.filter((l) => l.mismatchDetected);
  const recentErrors = syncLog.filter((l) => !l.success).slice(-20);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-civic-muted flex items-center justify-center">
                <Shield className="w-5 h-5 text-civic-light" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Legislation Sync Health
                </h1>
                <p className="text-xs text-text-muted">
                  Admin · API monitoring · Mismatch detection
                </p>
              </div>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {loading && !health && (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-civic-light mx-auto mb-4 animate-spin" />
              <p className="text-sm text-text-muted">Loading health data...</p>
            </div>
          )}

          {health && (
            <div className="space-y-6">
              {/* ── API Health Overview ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <HealthCard
                  label="API Status"
                  value={health.isHealthy ? 'Healthy' : 'Degraded'}
                  icon={health.isHealthy ? CheckCircle2 : AlertTriangle}
                  color={health.isHealthy ? 'positive' : 'danger'}
                />
                <HealthCard
                  label="Success Rate"
                  value={`${Math.round(health.successRate * 100)}%`}
                  icon={Activity}
                  color={health.successRate > 0.9 ? 'positive' : health.successRate > 0.5 ? 'warning' : 'danger'}
                />
                <HealthCard
                  label="Avg Latency"
                  value={`${health.avgLatencyMs}ms`}
                  icon={Zap}
                  color={health.avgLatencyMs < 1000 ? 'positive' : health.avgLatencyMs < 3000 ? 'warning' : 'danger'}
                />
                <HealthCard
                  label="Total Synced"
                  value={health.totalSynced.toString()}
                  icon={Database}
                  color="info"
                />
              </div>

              {/* ── Rate Limiting Alert ── */}
              {health.isRateLimited && (
                <div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-warning-light" />
                  <div>
                    <p className="text-sm font-semibold text-warning-light">Rate Limited</p>
                    <p className="text-xs text-text-muted">
                      Congress.gov API is rate-limiting requests. Automatic backoff in effect.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Mismatch Detection Incidents ── */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger-light" />
                  <h3 className="text-xs font-semibold text-text-primary">
                    Mismatch Detection
                  </h3>
                  <span className={clsx(
                    'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
                    mismatchEvents.length === 0
                      ? 'bg-positive/10 text-positive-light'
                      : 'bg-danger/10 text-danger-light',
                  )}>
                    {mismatchEvents.length} incidents
                  </span>
                </div>
                {mismatchEvents.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No data mismatches detected. All fetched bills matched their canonical keys.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {mismatchEvents.map((event, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 bg-danger/5 border border-danger/20 rounded-xl"
                      >
                        <XCircle className="w-3.5 h-3.5 text-danger-light mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-text-primary font-mono">
                            {event.canonicalKey}
                          </p>
                          <p className="text-xs text-text-muted">
                            {event.mismatchDetails} · {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Last Sync Times ── */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-civic-light" />
                  <h3 className="text-xs font-semibold text-text-primary">
                    Sync Timestamps
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-text-muted mb-0.5">Last Successful Sync</p>
                    <p className="text-text-primary font-medium">
                      {health.lastSuccessAt
                        ? new Date(health.lastSuccessAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-0.5">Last Failure</p>
                    <p className={clsx(
                      'font-medium',
                      health.lastFailureAt ? 'text-danger-light' : 'text-text-primary',
                    )}>
                      {health.lastFailureAt
                        ? new Date(health.lastFailureAt).toLocaleString()
                        : 'None'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-0.5">Total Errors</p>
                    <p className={clsx(
                      'font-medium',
                      health.totalErrors > 0 ? 'text-warning-light' : 'text-text-primary',
                    )}>
                      {health.totalErrors}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-0.5">Pending Syncs</p>
                    <p className="text-text-primary font-medium">{health.pendingSyncs}</p>
                  </div>
                </div>
              </div>

              {/* ── Recent Error Log ── */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-civic-light" />
                  <h3 className="text-xs font-semibold text-text-primary">
                    Recent Sync Log
                  </h3>
                  <span className="text-xs text-text-muted ml-auto">
                    {syncLog.length} entries
                  </span>
                </div>
                {syncLog.length === 0 ? (
                  <p className="text-xs text-text-muted">No sync activity recorded yet.</p>
                ) : (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {[...syncLog].reverse().slice(0, 50).map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover text-xs"
                      >
                        {entry.success ? (
                          <CheckCircle2 className="w-3 h-3 text-positive-light shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-danger-light shrink-0" />
                        )}
                        <span className="font-mono text-xs text-text-muted w-36 shrink-0 truncate">
                          {entry.canonicalKey}
                        </span>
                        <span className="text-text-secondary flex-1 min-w-0 truncate">
                          {entry.success
                            ? `OK (${entry.durationMs}ms)`
                            : entry.error || 'Error'}
                        </span>
                        <span className="text-xs text-text-muted shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

      <div className="h-20 lg:h-8" />
    </div>
  );
}

// ─── Health metric card ──────────────────────────────────────

function HealthCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  color: 'positive' | 'warning' | 'danger' | 'info';
}) {
  const colorClasses = {
    positive: 'text-positive-light',
    warning: 'text-warning-light',
    danger: 'text-danger-light',
    info: 'text-info-light',
  };

  return (
    <div className="p-3 bg-surface-elevated rounded-xl border border-border-subtle">
      <Icon className={clsx('w-4 h-4 mb-1', colorClasses[color])} />
      <p className={clsx('text-lg font-bold', colorClasses[color])}>{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}
