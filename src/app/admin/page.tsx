'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Users,
  Activity,
  TrendingUp,
  Search,
  Ban,
  CheckCircle2,
  Clock,
  MessageSquare,
  FileText,
  Bug,
  Lightbulb,
  ScrollText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'reports' | 'feedback' | 'audit';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  usersThisWeek: number;
  postsToday: number;
}

interface AdminUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  credibilityScore: number;
  followerCount: number;
  postCount: number;
  createdAt: string;
  suspendedUntil: string | null;
}

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporterId: string;
  postId: string;
}

interface Feedback {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

// ─── Tab Config ──────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'reports', label: 'Reports', icon: AlertTriangle },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];

// ─── Page ────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors shrink-0',
                tab === t.id
                  ? 'text-civic-light border-b-2 border-civic bg-civic/5'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'audit' && <AuditTab />}

      <div className="h-20 lg:h-8" />
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <ErrorMessage message="Failed to load stats." />;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-civic-light' },
    { label: 'Total Posts', value: stats.totalPosts.toLocaleString(), icon: FileText, color: 'text-positive-light' },
    { label: 'Comments', value: stats.totalComments.toLocaleString(), icon: MessageSquare, color: 'text-info-light' },
    { label: 'New Users (7d)', value: `+${stats.usersThisWeek}`, icon: TrendingUp, color: 'text-warning-light' },
    { label: 'Posts Today', value: stats.postsToday.toLocaleString(), icon: Activity, color: 'text-civic-light' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="p-4 bg-surface-elevated rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">{c.label}</span>
                <Icon className={clsx('w-4 h-4', c.color)} />
              </div>
              <p className={clsx('text-2xl font-bold', c.color)}>{c.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&page=${page}&limit=20`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [query, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async (userId: string, action: string, extra?: Record<string, string>) => {
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      await fetchUsers();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40"
          />
        </div>
        <span className="text-xs text-text-muted shrink-0">{total} users</span>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-civic/10 flex items-center justify-center text-civic-light text-xs font-bold shrink-0">
                  {u.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{u.displayName}</span>
                    <span className="text-[10px] text-text-muted">@{u.username}</span>
                    <RoleBadge role={u.role} />
                    {u.suspendedUntil && new Date(u.suspendedUntil) > new Date() && (
                      <span className="text-[10px] bg-warning/10 text-warning-light px-1.5 py-0.5 rounded-md font-medium">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted">{u.email} · {u.postCount} posts · Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {u.role !== 'banned' && u.role !== 'admin' && u.role !== 'creator' && (
                    <>
                      <button
                        onClick={() => handleAction(u.id, 'suspend', { suspendUntil: new Date(Date.now() + 7 * 86400000).toISOString(), reason: '7-day suspension' })}
                        disabled={actionLoading === u.id}
                        className="text-[10px] px-2 py-1 rounded-md bg-warning/10 text-warning-light hover:bg-warning/20 font-medium transition-colors disabled:opacity-50"
                      >
                        Suspend 7d
                      </button>
                      <button
                        onClick={() => handleAction(u.id, 'ban', { reason: 'Banned by admin' })}
                        disabled={actionLoading === u.id}
                        className="text-[10px] px-2 py-1 rounded-md bg-danger/10 text-danger-light hover:bg-danger/20 font-medium transition-colors disabled:opacity-50"
                      >
                        Ban
                      </button>
                    </>
                  )}
                  {u.role === 'banned' && (
                    <button
                      onClick={() => handleAction(u.id, 'unban', { reason: 'Unbanned by admin' })}
                      disabled={actionLoading === u.id}
                      className="text-[10px] px-2 py-1 rounded-md bg-positive/10 text-positive-light hover:bg-positive/20 font-medium transition-colors disabled:opacity-50"
                    >
                      Unban
                    </button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="px-4 py-8 text-sm text-text-muted text-center">No users found.</p>}
          </div>
        </div>
      )}

      <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────

function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?page=${page}&limit=20`);
      const data = await res.json();
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleResolve = async (reportId: string, status: string) => {
    await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchReports();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">{total} total reports</p>
      {reports.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No reports yet.</p>
      ) : (
        <div className="bg-surface-elevated rounded-xl border border-border-subtle divide-y divide-border-subtle">
          {reports.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ReportStatusBadge status={r.status} />
                    <span className="text-xs font-medium text-text-primary">{r.reason}</span>
                    <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                  </div>
                  {r.details && <p className="text-[11px] text-text-muted line-clamp-2">{r.details}</p>}
                  <p className="text-[10px] text-text-muted mt-1">Post: {r.postId} · Reporter: {r.reporterId}</p>
                </div>
                {r.status === 'PENDING' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleResolve(r.id, 'ACTIONED')} className="text-[10px] px-2 py-1 rounded-md bg-positive/10 text-positive-light hover:bg-positive/20 font-medium">Action</button>
                    <button onClick={() => handleResolve(r.id, 'DISMISSED')} className="text-[10px] px-2 py-1 rounded-md bg-surface-active text-text-muted hover:bg-surface-hover font-medium">Dismiss</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
    </div>
  );
}

// ─── Feedback Tab ────────────────────────────────────────────

function FeedbackTab() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/feedback?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((data) => { setItems(data.feedback || []); setTotal(data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <LoadingSpinner />;

  const typeIcon: Record<string, typeof Bug> = { bug: Bug, feature: Lightbulb, general: MessageSquare };

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">{total} feedback submissions</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No feedback yet.</p>
      ) : (
        <div className="bg-surface-elevated rounded-xl border border-border-subtle divide-y divide-border-subtle">
          {items.map((f) => {
            const Icon = typeIcon[f.type] || MessageSquare;
            return (
              <div key={f.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Icon className={clsx('w-4 h-4 mt-0.5 shrink-0', f.type === 'bug' ? 'text-danger-light' : f.type === 'feature' ? 'text-warning-light' : 'text-text-muted')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-text-primary">{f.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-active text-text-muted font-medium">{f.type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-active text-text-muted font-medium">{f.status}</span>
                    </div>
                    <p className="text-[11px] text-text-muted line-clamp-2">{f.description}</p>
                    <p className="text-[10px] text-text-muted mt-1">{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
    </div>
  );
}

// ─── Audit Log Tab ───────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => { setLogs(data.logs || []); setTotal(data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">{total} audit entries</p>
      {logs.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-12">No audit log entries yet.</p>
      ) : (
        <div className="bg-surface-elevated rounded-xl border border-border-subtle divide-y divide-border-subtle">
          {logs.map((l) => (
            <div key={l.id} className="px-4 py-2.5 flex items-center gap-3">
              <Shield className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text-primary font-medium">{l.action}</span>
                <span className="text-[10px] text-text-muted ml-2">{l.targetType}:{l.targetId.slice(0, 12)}</span>
              </div>
              <span className="text-[10px] text-text-muted shrink-0">
                {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 text-civic animate-spin" />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <AlertTriangle className="w-6 h-6 text-danger-light mx-auto mb-2" />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    user: 'bg-surface-active text-text-muted',
    moderator: 'bg-info/10 text-info-light',
    admin: 'bg-civic/10 text-civic-light',
    creator: 'bg-positive/10 text-positive-light',
    banned: 'bg-danger/10 text-danger-light',
  };
  return (
    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md', styles[role] || styles.user)}>
      {role}
    </span>
  );
}

function ReportStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-warning/10 text-warning-light',
    REVIEWED: 'bg-info/10 text-info-light',
    ACTIONED: 'bg-positive/10 text-positive-light',
    DISMISSED: 'bg-surface-active text-text-muted',
  };
  return (
    <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md', styles[status] || styles.PENDING)}>
      {status}
    </span>
  );
}

function Pagination({ page, total, limit, onPageChange }: { page: number; total: number; limit: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1.5 rounded-md hover:bg-surface-hover disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-text-muted" />
      </button>
      <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1.5 rounded-md hover:bg-surface-hover disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-text-muted" />
      </button>
    </div>
  );
}
