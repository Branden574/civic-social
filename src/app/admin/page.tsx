'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  Users,
  Activity,
  TrendingUp,
  Eye,
  EyeOff,
  Trash2,
  Bot,
  ShieldCheck,
  Zap,
  Download,
  Lock,
  Radio,
  Clock,
  ChevronRight,
  CheckCircle2,
  Landmark,
  Scale,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down'; text: string };
  color: string;
  icon: typeof Shield;
}

interface ModerationAction {
  id: string;
  snippet: string;
  action: 'warn' | 'hide' | 'remove';
  reason: string;
  timestamp: string;
  automated: boolean;
}

interface SystemHealthItem {
  label: string;
  status: string;
  statusColor: 'green' | 'yellow' | 'red';
  detail: string;
}

// ─── Mock Data ───────────────────────────────────────────────

const STATS: StatCard[] = [
  {
    label: 'Active Reports',
    value: '23',
    trend: { direction: 'up', text: '+5 today' },
    color: 'text-danger-light',
    icon: AlertTriangle,
  },
  {
    label: 'Content Actions Today',
    value: '12',
    trend: undefined,
    color: 'text-warning-light',
    icon: Shield,
  },
  {
    label: 'Active Users',
    value: '1,247',
    trend: { direction: 'up', text: '+89 this week' },
    color: 'text-civic-light',
    icon: Users,
  },
  {
    label: 'Threat Level',
    value: 'Low',
    trend: undefined,
    color: 'text-positive-light',
    icon: Activity,
  },
];

const RECENT_ACTIONS: ModerationAction[] = [
  {
    id: 'act-1',
    snippet: '"All [group] are responsible for..." — Flagged for hate speech targeting a protected group.',
    action: 'remove',
    reason: 'Hate speech',
    timestamp: '12 min ago',
    automated: true,
  },
  {
    id: 'act-2',
    snippet: '"EXPOSED!!! The REAL truth about the vaccine conspiracy..." — Coordinated misinfo campaign.',
    action: 'hide',
    reason: 'Misinformation',
    timestamp: '34 min ago',
    automated: true,
  },
  {
    id: 'act-3',
    snippet: '"I\'m going to find you and make you regret..." — Direct threat reported by multiple users.',
    action: 'remove',
    reason: 'Threats / violence',
    timestamp: '1 hr ago',
    automated: false,
  },
  {
    id: 'act-4',
    snippet: '"This so-called expert is a complete fraud..." — Personal attack, low civility score.',
    action: 'warn',
    reason: 'Harassment',
    timestamp: '2 hr ago',
    automated: true,
  },
  {
    id: 'act-5',
    snippet: '"Buy crypto NOW at this link!!!" — Spam account detected, duplicate posts across 8 threads.',
    action: 'remove',
    reason: 'Spam / manipulation',
    timestamp: '3 hr ago',
    automated: true,
  },
];

const SYSTEM_HEALTH: SystemHealthItem[] = [
  {
    label: 'Bot Detection',
    status: '99.2% accuracy',
    statusColor: 'green',
    detail: 'ML model v4.2 — last retrained 3 days ago',
  },
  {
    label: 'DDoS Protection',
    status: 'Active',
    statusColor: 'green',
    detail: 'Cloudflare edge — 0 incidents this week',
  },
  {
    label: 'Rate Limiting',
    status: 'Normal',
    statusColor: 'green',
    detail: '15 req/min per user — 3 throttled today',
  },
  {
    label: 'Election Mode',
    status: 'Standby',
    statusColor: 'yellow',
    detail: 'Ready to activate — triggers enhanced verification + slower posting',
  },
];

const ACTION_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  warn: { label: 'Warned', bg: 'bg-warning/10', text: 'text-warning-light' },
  hide: { label: 'Hidden', bg: 'bg-[#EAB308]/10', text: 'text-[#EAB308]' },
  remove: { label: 'Removed', bg: 'bg-danger/10', text: 'text-danger-light' },
};

const STATUS_DOT: Record<string, string> = {
  green: 'bg-positive',
  yellow: 'bg-warning',
  red: 'bg-danger',
};

// ─── Page Component ──────────────────────────────────────────

export default function AdminPage() {
  const [electionMode, setElectionMode] = useState(false);
  // Auth and role checks are handled by app/admin/layout.tsx

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Hub: Quick links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/admin/legislation" className="flex items-center gap-3 p-4 bg-surface-elevated rounded-xl border border-border-subtle hover:border-civic/30 hover:bg-surface-hover transition-all group">
          <div className="w-10 h-10 rounded-lg bg-civic/10 flex items-center justify-center shrink-0"><Landmark className="w-5 h-5 text-civic-light" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Legislation Sync</p>
            <p className="text-[11px] text-text-muted">API health, sync log</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light shrink-0" />
        </Link>
        <Link href="/appeals" className="flex items-center gap-3 p-4 bg-surface-elevated rounded-xl border border-border-subtle hover:border-civic/30 hover:bg-surface-hover transition-all group">
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0"><Scale className="w-5 h-5 text-info-light" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Appeals</p>
            <p className="text-[11px] text-text-muted">Review content appeals</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light shrink-0" />
        </Link>
        <Link href="/admin/guide" className="flex items-center gap-3 p-4 bg-surface-elevated rounded-xl border border-border-subtle hover:border-civic/30 hover:bg-surface-hover transition-all group">
          <div className="w-10 h-10 rounded-lg bg-positive/10 flex items-center justify-center shrink-0"><Info className="w-5 h-5 text-positive-light" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Admin Guide</p>
            <p className="text-[11px] text-text-muted">Roles and login</p>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light shrink-0" />
        </Link>
      </div>

      {/* ── Stats Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="p-4 bg-surface-elevated rounded-xl border border-border-subtle"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                        {stat.label}
                      </span>
                      <Icon className={clsx('w-4 h-4', stat.color)} />
                    </div>
                    <p className={clsx('text-2xl font-bold', stat.color)}>
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp
                          className={clsx(
                            'w-3 h-3',
                            stat.trend.direction === 'up'
                              ? 'text-danger-light'
                              : 'text-positive-light',
                          )}
                        />
                        <span className="text-[11px] text-text-muted">
                          {stat.trend.text}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Recent Actions ── */}
            <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Recent Actions
                </h2>
                <button className="text-[11px] font-medium text-civic-light hover:underline flex items-center gap-1">
                  View All
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="divide-y divide-border-subtle">
                {RECENT_ACTIONS.map((action) => {
                  const style = ACTION_STYLES[action.action];
                  return (
                    <div
                      key={action.id}
                      className="px-4 py-3 hover:bg-surface/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {/* Action icon */}
                        <div
                          className={clsx(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            style.bg,
                          )}
                        >
                          {action.action === 'remove' ? (
                            <Trash2 className={clsx('w-4 h-4', style.text)} />
                          ) : action.action === 'hide' ? (
                            <EyeOff className={clsx('w-4 h-4', style.text)} />
                          ) : (
                            <AlertTriangle className={clsx('w-4 h-4', style.text)} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Content snippet */}
                          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                            {action.snippet}
                          </p>

                          {/* Meta row */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              className={clsx(
                                'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                                style.bg,
                                style.text,
                              )}
                            >
                              {style.label}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {action.reason}
                            </span>
                            <span className="text-text-muted">·</span>
                            <span className="text-[10px] text-text-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {action.timestamp}
                            </span>
                            <span className="text-text-muted">·</span>
                            <span
                              className={clsx(
                                'text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                                action.automated
                                  ? 'bg-civic/10 text-civic-light'
                                  : 'bg-surface-active text-text-secondary',
                              )}
                            >
                              {action.automated ? (
                                <span className="flex items-center gap-1">
                                  <Bot className="w-3 h-3" />
                                  Automated
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  Human Review
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── System Health ── */}
            <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-positive-light" />
                  System Health
                </h2>
              </div>

              <div className="divide-y divide-border-subtle">
                {SYSTEM_HEALTH.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {/* Status dot */}
                    <span
                      className={clsx(
                        'w-2.5 h-2.5 rounded-full shrink-0',
                        STATUS_DOT[item.statusColor],
                        item.statusColor === 'yellow' && 'animate-pulse',
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {item.label}
                        </span>
                        <span
                          className={clsx(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                            item.statusColor === 'green' && 'bg-positive/10 text-positive-light',
                            item.statusColor === 'yellow' && 'bg-warning/10 text-warning-light',
                            item.statusColor === 'red' && 'bg-danger/10 text-danger-light',
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {item.detail}
                      </p>
                    </div>

                    {/* Progress bar for Bot Detection */}
                    {item.label === 'Bot Detection' && (
                      <div className="w-24 h-1.5 bg-surface-active rounded-full overflow-hidden">
                        <div
                          className="h-full bg-positive rounded-full"
                          style={{ width: '99.2%' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-warning-light" />
                  Quick Actions
                </h2>
              </div>

              <div className="p-4 flex flex-wrap gap-3">
                {/* Election Mode */}
                <button
                  onClick={() => setElectionMode(!electionMode)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    electionMode
                      ? 'bg-warning text-black hover:bg-warning/90'
                      : 'bg-warning/10 text-warning-light hover:bg-warning/20 border border-warning/20',
                  )}
                >
                  <Radio className="w-4 h-4" />
                  {electionMode ? 'Election Mode: ON' : 'Enable Election Mode'}
                  {electionMode && (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </button>

                {/* Lockdown Mode */}
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-danger/10 text-danger-light hover:bg-danger/20 border border-danger/20 transition-all">
                  <Lock className="w-4 h-4" />
                  Lockdown Mode
                </button>

                {/* Export Audit Log */}
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle transition-all">
                  <Download className="w-4 h-4" />
                  Export Audit Log
                </button>
              </div>

              {/* Election Mode description */}
              {electionMode && (
                <div className="mx-4 mb-4 p-3 bg-warning/5 border border-warning/20 rounded-lg animate-fade-in">
                  <p className="text-xs font-semibold text-warning-light mb-1">
                    Election Mode Active
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Enhanced verification for all political content. Posting cooldowns increased
                    to 60 seconds. Misinformation detection sensitivity raised. Source requirements
                    enforced for election-related claims.
                  </p>
                </div>
              )}
            </div>

          <div className="h-20 lg:h-8" />
    </div>
  );
}
