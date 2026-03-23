'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { CreateDebateModal } from '@/components/debates/create-debate-modal';
import {
  MessageSquare,
  Users,
  Clock,
  Shield,
  ArrowLeftRight,
  Eye,
  Zap,
  Plus,
  Flame,
  Crown,
  Play,
  CheckCircle2,
  Pause as PauseIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Types (matching debate-store.ts) ────────────────────────────

interface DebateSide { label: string; ideology: string }
interface Participant { userId: string; displayName: string; side: 'A' | 'B'; joinedAt: string }
interface Debate {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  sideA: DebateSide;
  sideB: DebateSide;
  topics: string[];
  status: 'waiting' | 'live' | 'paused' | 'completed';
  durationMinutes: number;
  startedAt: string | null;
  pausedAt: string | null;
  elapsedBeforePauseMs: number;
  completedAt: string | null;
  stages: string[];
  currentStageIndex: number;
  participants: Participant[];
  spectatorCount: number;
  civilityScore: number;
  createdAt: string;
}

// ─── Live timer hook (updates every second) ──────────────────────

function useTickingTimer() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return tick;
}

function getRemainingMs(debate: Debate): number {
  if (!debate.startedAt) return debate.durationMinutes * 60 * 1000;
  const totalMs = debate.durationMinutes * 60 * 1000;
  let elapsed: number;
  if (debate.status === 'paused') {
    elapsed = debate.elapsedBeforePauseMs;
  } else if (debate.status === 'completed' && debate.completedAt) {
    elapsed = new Date(debate.completedAt).getTime() - new Date(debate.startedAt).getTime();
  } else {
    elapsed = Date.now() - new Date(debate.startedAt).getTime();
  }
  return Math.max(0, totalMs - elapsed);
}

function getElapsedMs(debate: Debate): number {
  if (!debate.startedAt) return 0;
  if (debate.status === 'paused') return debate.elapsedBeforePauseMs;
  if (debate.status === 'completed' && debate.completedAt) {
    return new Date(debate.completedAt).getTime() - new Date(debate.startedAt).getTime();
  }
  return Date.now() - new Date(debate.startedAt).getTime();
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Status styles ───────────────────────────────────────────────

const statusStyles: Record<string, { label: string; color: string; dot: string }> = {
  live: { label: 'LIVE', color: 'bg-danger/10 text-danger-light', dot: 'bg-danger animate-pulse' },
  paused: { label: 'PAUSED', color: 'bg-warning/10 text-warning-light', dot: 'bg-warning' },
  waiting: { label: 'WAITING', color: 'bg-info/10 text-info-light', dot: 'bg-info' },
  completed: { label: 'COMPLETED', color: 'bg-surface-active text-text-muted', dot: 'bg-text-muted' },
};

// ─── Page ────────────────────────────────────────────────────────

export default function DebatesPage() {
  const router = useRouter();
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  useTickingTimer(); // Force re-render every second for live timers

  const fetchDebates = useCallback(async () => {
    try {
      const res = await fetch(`/api/debates?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setDebates(data.debates);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDebates(); }, [fetchDebates]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchDebates, 30000);
    return () => clearInterval(interval);
  }, [fetchDebates]);

  const handleCreated = (debate: unknown) => {
    fetchDebates();
    // Navigate to the new debate so the user can invite people and start it
    const d = debate as Debate | undefined;
    if (d?.id) {
      router.push(`/debates/${d.id}`);
    }
  };

  // Categorize
  const popular = [...debates]
    .filter((d) => d.status === 'live' || d.status === 'paused')
    .sort((a, b) => b.spectatorCount - a.spectatorCount)
    .slice(0, 3);
  const liveDebates = debates.filter((d) => d.status === 'live' || d.status === 'paused');
  const waitingDebates = debates.filter((d) => d.status === 'waiting');
  const completedDebates = debates.filter((d) => d.status === 'completed');

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-5 sm:px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-civic-light" />
                <div>
                  <h1 className="text-lg font-bold text-text-primary">Debate Rooms</h1>
                  <p className="text-xs text-text-muted">Structured, timed, live debates with real-time civility scoring</p>
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Debate
              </button>
            </div>
            {/* Format explainer */}
            <div className="flex items-center gap-2 sm:gap-3 mt-3 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-warning" />Opening</span>
              <span>→</span><span>Rebuttal</span><span>→</span><span className="hidden sm:inline">Cross-Exam</span><span className="sm:hidden">X-Exam</span><span>→</span><span>Closing</span><span>→</span><span>Sources</span>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-civic border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ═══ Popular Debates Section ═══ */}
              {popular.length > 0 && (
                <section className="px-4 sm:px-6 py-5 border-b border-border-subtle">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-warning" />
                    <h2 className="text-sm font-bold text-text-primary">Popular Debates</h2>
                    <span className="text-xs text-text-muted ml-1">Most spectators</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {popular.map((debate) => (
                      <PopularCard key={debate.id} debate={debate} />
                    ))}
                  </div>
                </section>
              )}

              {/* ═══ Live Now ═══ */}
              {liveDebates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 sm:px-6 pt-5 pb-2">
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                    <h2 className="text-sm font-bold text-text-primary">Live Now</h2>
                    <span className="text-xs text-text-muted">{liveDebates.length} active</span>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {liveDebates.map((debate, i) => (
                      <DebateRow key={debate.id} debate={debate} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ═══ Waiting to Start ═══ */}
              {waitingDebates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 sm:px-6 pt-5 pb-2">
                    <Play className="w-3.5 h-3.5 text-info-light" />
                    <h2 className="text-sm font-bold text-text-primary">Waiting to Start</h2>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {waitingDebates.map((debate, i) => (
                      <DebateRow key={debate.id} debate={debate} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ═══ Completed ═══ */}
              {completedDebates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 px-4 sm:px-6 pt-5 pb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-text-muted" />
                    <h2 className="text-sm font-bold text-text-primary">Completed</h2>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {completedDebates.map((debate, i) => (
                      <DebateRow key={debate.id} debate={debate} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {debates.length === 0 && (
                <div className="px-4 sm:px-6 py-20 text-center">
                  <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary mb-2">No debates yet.</p>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="text-sm text-civic-light hover:underline"
                  >
                    Create the first debate
                  </button>
                </div>
              )}
            </>
          )}

          <div className="h-20 lg:h-8" />
        </div>

        <CreateDebateModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}

// ─── Popular Debate Card (compact, highlighted) ──────────────────

function PopularCard({ debate }: { debate: Debate }) {
  const remaining = getRemainingMs(debate);
  const status = statusStyles[debate.status];

  return (
    <Link
      href={`/debates/${debate.id}`}
      className="block p-4 bg-surface-elevated rounded-xl border border-border-subtle hover:border-civic/30 transition-colors group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={clsx('flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md', status.color)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Eye className="w-3 h-3" />
          <span className="font-semibold text-text-secondary">{debate.spectatorCount}</span>
        </span>
      </div>
      <h3 className="text-sm font-semibold text-text-primary leading-snug mb-2 group-hover:text-civic-light transition-colors line-clamp-2">
        {debate.title}
      </h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <Users className="w-3 h-3" />
          {debate.participants.length}
        </div>
        <div className={clsx(
          'flex items-center gap-1 text-xs font-mono',
          debate.status === 'live' ? 'text-danger-light' : 'text-text-muted',
        )}>
          <Clock className="w-3 h-3" />
          {formatTime(remaining)}
        </div>
      </div>
    </Link>
  );
}

// ─── Debate Row (full listing) ───────────────────────────────────

function DebateRow({ debate, index }: { debate: Debate; index: number }) {
  const status = statusStyles[debate.status];
  const remaining = getRemainingMs(debate);
  const elapsed = getElapsedMs(debate);
  const totalMs = debate.durationMinutes * 60 * 1000;
  const progressPct = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;

  return (
    <Link
      href={`/debates/${debate.id}`}
      className="block feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-5 hover:bg-surface/40 transition-colors"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
    >
      {/* Status + Title + Timer */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={clsx('flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md', status.color)}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
            {debate.status === 'live' && (
              <span className="text-xs font-mono text-text-muted">
                Stage: {debate.stages[debate.currentStageIndex]}
              </span>
            )}
            <span className="text-xs text-text-muted flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5 text-warning" />
              {debate.creatorName}
            </span>
          </div>
          <h2 className="text-base font-semibold text-text-primary leading-snug">{debate.title}</h2>
        </div>

        {/* Live timer */}
        {(debate.status === 'live' || debate.status === 'paused') && (
          <div className={clsx(
            'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl font-mono',
            debate.status === 'live' ? 'bg-danger/10' : 'bg-warning/10',
          )}>
            <span className={clsx(
              'text-lg font-bold leading-none',
              debate.status === 'live' ? 'text-danger-light' : 'text-warning-light',
            )}>
              {formatTime(remaining)}
            </span>
            <span className="text-[9px] text-text-muted">remaining</span>
          </div>
        )}
      </div>

      {/* Timer progress bar (live/paused only) */}
      {(debate.status === 'live' || debate.status === 'paused') && (
        <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-3">
          <div
            className={clsx(
              'h-full rounded-full transition-colors',
              progressPct > 90 ? 'bg-danger' : progressPct > 70 ? 'bg-warning' : 'bg-civic',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Sides */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 p-3 rounded-xl border bg-surface-elevated border-border-subtle text-center">
          <p className="text-sm font-semibold text-text-primary">{debate.sideA.label}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {debate.participants.filter((p) => p.side === 'A').length} debaters
          </p>
          <span className={clsx('inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-1', getAffStyle(debate.sideA.ideology))}>
            {debate.sideA.ideology}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowLeftRight className="w-4 h-4 text-text-muted" />
          <span className="text-[9px] text-text-muted font-medium">VS</span>
        </div>
        <div className="flex-1 p-3 rounded-xl border bg-surface-elevated border-border-subtle text-center">
          <p className="text-sm font-semibold text-text-primary">{debate.sideB.label}</p>
          <p className="text-xs text-text-muted mt-0.5">
            {debate.participants.filter((p) => p.side === 'B').length} debaters
          </p>
          <span className={clsx('inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-1', getAffStyle(debate.sideB.ideology))}>
            {debate.sideB.ideology}
          </span>
        </div>
      </div>

      {/* Topics */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {debate.topics.map((topic) => (
          <span key={topic} className="text-xs font-medium text-civic-light bg-civic-subtle px-2 py-0.5 rounded-full">
            #{topic}
          </span>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs text-text-muted">
        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{debate.spectatorCount} spectators</span>
        {debate.civilityScore > 0 && (
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Civility: <span className="text-positive-light font-semibold">{Math.round(debate.civilityScore * 100)}%</span>
          </span>
        )}
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{debate.participants.length} total debaters</span>
      </div>
    </Link>
  );
}

function getAffStyle(aff: string): string {
  const map: Record<string, string> = {
    left: 'bg-ideology-left/15 text-ideology-left',
    'center-left': 'bg-ideology-center-left/15 text-ideology-center-left',
    center: 'bg-ideology-center/15 text-ideology-center',
    'center-right': 'bg-ideology-center-right/15 text-ideology-center-right',
    right: 'bg-ideology-right/15 text-ideology-right',
  };
  return map[aff] || 'bg-surface-active text-text-muted';
}
