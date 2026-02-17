// ═══════════════════════════════════════════════════════════════
// Civic Social — Security Monitoring & Alerting
// ═══════════════════════════════════════════════════════════════
//
// Tracks security-relevant events and triggers alerts.
// In production, connect to a SIEM (e.g., Datadog, Sentry,
// PagerDuty) for real-time alerting.
// ═══════════════════════════════════════════════════════════════

import { secureLog } from './logger';

// ─── Event types ─────────────────────────────────────────────

export type SecurityEventType =
  | 'auth_failure'
  | 'auth_lockout'
  | 'rate_limit_hit'
  | 'csrf_violation'
  | 'admin_login'
  | 'admin_action'
  | 'suspicious_activity'
  | 'data_integrity_error'
  | 'api_error_spike'
  | 'ddos_pattern';

interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  ip?: string;
  userId?: string;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ─── In-memory event store (production: use external service) ─

const eventBuffer: SecurityEvent[] = [];
const MAX_BUFFER_SIZE = 10_000;

// Anomaly detection counters
const eventCounters = new Map<string, { count: number; windowStart: number }>();
const ANOMALY_WINDOW_MS = 5 * 60_000; // 5 minutes

// ─── Alert thresholds ────────────────────────────────────────

const ALERT_THRESHOLDS: Record<SecurityEventType, { count: number; windowMs: number; severity: SecurityEvent['severity'] }> = {
  auth_failure: { count: 20, windowMs: 5 * 60_000, severity: 'high' },
  auth_lockout: { count: 5, windowMs: 15 * 60_000, severity: 'high' },
  rate_limit_hit: { count: 100, windowMs: 60_000, severity: 'medium' },
  csrf_violation: { count: 10, windowMs: 60_000, severity: 'critical' },
  admin_login: { count: 3, windowMs: 60_000, severity: 'medium' },
  admin_action: { count: 50, windowMs: 5 * 60_000, severity: 'medium' },
  suspicious_activity: { count: 5, windowMs: 5 * 60_000, severity: 'high' },
  data_integrity_error: { count: 3, windowMs: 60_000, severity: 'critical' },
  api_error_spike: { count: 50, windowMs: 60_000, severity: 'high' },
  ddos_pattern: { count: 500, windowMs: 60_000, severity: 'critical' },
};

// ─── Core recording function ─────────────────────────────────

export function recordSecurityEvent(
  type: SecurityEventType,
  details: Record<string, unknown>,
  options?: { ip?: string; userId?: string },
) {
  const event: SecurityEvent = {
    type,
    timestamp: new Date().toISOString(),
    ip: options?.ip,
    userId: options?.userId,
    details,
    severity: ALERT_THRESHOLDS[type]?.severity || 'low',
  };

  // Add to buffer
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE);
  }

  // Check for anomaly threshold
  const counterKey = type;
  const now = Date.now();
  const counter = eventCounters.get(counterKey);
  const threshold = ALERT_THRESHOLDS[type];

  if (counter && now - counter.windowStart < threshold.windowMs) {
    counter.count++;
    if (counter.count === threshold.count) {
      triggerAlert(type, counter.count, threshold.windowMs);
    }
  } else {
    eventCounters.set(counterKey, { count: 1, windowStart: now });
  }

  // Always log high/critical events
  if (event.severity === 'high' || event.severity === 'critical') {
    secureLog.warn('SECURITY', `[${event.severity.toUpperCase()}] ${type}`, details);
  }
}

// ─── Alert trigger ───────────────────────────────────────────

function triggerAlert(type: SecurityEventType, count: number, windowMs: number) {
  const windowMinutes = Math.round(windowMs / 60_000);

  secureLog.error('SECURITY_ALERT', {
    type,
    message: `Alert threshold reached: ${count} ${type} events in ${windowMinutes} minutes`,
    action: 'INVESTIGATE IMMEDIATELY',
    timestamp: new Date().toISOString(),
  });

  // PRODUCTION: Send to PagerDuty, Slack, email, etc.
  // await fetch(process.env.ALERT_WEBHOOK_URL, { ... });
}

// ─── Query interface ─────────────────────────────────────────

export function getRecentEvents(
  type?: SecurityEventType,
  limit = 100,
): SecurityEvent[] {
  let filtered = eventBuffer;
  if (type) {
    filtered = eventBuffer.filter((e) => e.type === type);
  }
  return filtered.slice(-limit);
}

export function getEventCounts(windowMs = 5 * 60_000): Record<SecurityEventType, number> {
  const now = Date.now();
  const cutoff = now - windowMs;
  const counts: Partial<Record<SecurityEventType, number>> = {};

  for (const event of eventBuffer) {
    if (new Date(event.timestamp).getTime() > cutoff) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
  }

  return counts as Record<SecurityEventType, number>;
}

// ─── Health check ────────────────────────────────────────────

export function getSecurityHealth(): {
  status: 'healthy' | 'degraded' | 'critical';
  recentAlerts: number;
  eventCounts: Record<string, number>;
} {
  const counts = getEventCounts();
  const criticalEvents = (counts.csrf_violation || 0) +
    (counts.data_integrity_error || 0) +
    (counts.ddos_pattern || 0);

  const highEvents = (counts.auth_failure || 0) +
    (counts.suspicious_activity || 0) +
    (counts.api_error_spike || 0);

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalEvents > 0) status = 'critical';
  else if (highEvents > 10) status = 'degraded';

  return {
    status,
    recentAlerts: criticalEvents + highEvents,
    eventCounts: counts,
  };
}
