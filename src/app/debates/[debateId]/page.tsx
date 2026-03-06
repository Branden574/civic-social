'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { LiveChat } from '@/components/debates/live-chat';
import { VoiceChat } from '@/components/debates/voice-chat';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  SkipForward,
  Eye,
  Shield,
  Users,
  Clock,
  UserPlus,
  UserMinus,
  Crown,
  ArrowLeftRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  MessageSquare,
  Mic,
} from 'lucide-react';
import clsx from 'clsx';

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
  invitedUserIds: string[];
  kickedUserIds: string[];
  civilityScore: number;
  createdAt: string;
}

// currentUserId is resolved from auth at runtime — see useAuth() below

interface InviteableUser { id: string; displayName: string }

// ─── Live timer hook ─────────────────────────────────────────────

function useLiveTimer(debate: Debate | null) {
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!debate || !debate.startedAt) {
      setElapsed(0);
      return;
    }

    function tick() {
      if (!debate || !debate.startedAt) return;

      if (debate.status === 'live') {
        const ms = Date.now() - new Date(debate.startedAt).getTime();
        setElapsed(ms);
      } else if (debate.status === 'paused') {
        setElapsed(debate.elapsedBeforePauseMs);
      } else if (debate.status === 'completed') {
        if (debate.completedAt) {
          setElapsed(new Date(debate.completedAt).getTime() - new Date(debate.startedAt).getTime());
        }
        return; // don't keep ticking
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [debate]);

  const totalMs = (debate?.durationMinutes ?? 0) * 60 * 1000;
  const remaining = Math.max(0, totalMs - elapsed);

  return { elapsed, remaining, totalMs };
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Page ────────────────────────────────────────────────────────

export default function DebateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const debateId = params.debateId as string;
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteableUsers, setInviteableUsers] = useState<InviteableUser[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showMobilePanel, setShowMobilePanel] = useState<'chat' | 'voice' | null>(null);

  const { elapsed, remaining, totalMs } = useLiveTimer(debate);
  const isCreator = !!currentUserId && debate?.creatorId === currentUserId;
  const isDebater = !!currentUserId && (debate?.participants.some((p) => p.userId === currentUserId) ?? false);
  const progressPct = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;
  const hasSpectatedRef = useRef(false);

  // ── Fetch debate (with retry for cold-start race conditions) ──
  const fetchDebate = useCallback(async (retries = 2) => {
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}?_t=${Date.now()}`);
      if (!res.ok) {
        if (res.status === 404 && retries > 0) {
          // Serverless cold start may not have re-seeded yet — retry
          await new Promise((r) => setTimeout(r, 800));
          return fetchDebate(retries - 1);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setDebate(data.debate);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [debateId]);

  useEffect(() => { fetchDebate(); }, [fetchDebate]);

  // ── Fetch users for invite panel ──────────────────────────────
  useEffect(() => {
    if (!showInvitePanel) return;
    setInviteLoading(true);
    const controller = new AbortController();
    const q = inviteSearch.trim();
    fetch(`/api/search/users?q=${encodeURIComponent(q)}&limit=20`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.users) {
          setInviteableUsers(data.users.map((u: { id: string; displayName: string }) => ({ id: u.id, displayName: u.displayName })));
        }
      })
      .catch(() => { /* ignore abort */ })
      .finally(() => setInviteLoading(false));
    return () => controller.abort();
  }, [showInvitePanel, inviteSearch]);

  // ── Auto-spectate: increment spectator count once per visit ──
  // If the user is not a debate participant, count them as a spectator.
  // This fires once after the debate data is loaded.
  useEffect(() => {
    if (!debate || hasSpectatedRef.current) return;
    // Only spectate if not already a debater (avoids double-counting)
    const alreadyParticipant = debate.participants.some((p) => p.userId === currentUserId);
    if (!alreadyParticipant) {
      hasSpectatedRef.current = true;
      fetch(`/api/debates/${encodeURIComponent(debateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spectate' }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.debate) setDebate(data.debate);
        }
      }).catch(() => { /* ignore */ });
    }
  }, [debate, debateId]);

  // Auto-refresh debate state every 5s (keeps spectator/participant counts live)
  useEffect(() => {
    if (!debate) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setDebate(data.debate);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [debate, debateId]);

  // ── Creator actions ──────────────────────────────────────────
  const doAction = useCallback(async (action: string, extra?: Record<string, string>) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok && data.debate) {
        setDebate(data.debate);
        setToast({ message: action === 'kick' ? 'User removed from debate.' : `Debate ${action}ed.`, type: 'success' });
      } else {
        setToast({ message: data.error || 'Action failed.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    } finally { setActionLoading(null); }
  }, [debateId]);

  const handleInvite = useCallback(async (targetUserId: string) => {
    setActionLoading('invite-' + targetUserId);
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: 'Invite sent!', type: 'success' });
        // Refresh
        const r2 = await fetch(`/api/debates/${encodeURIComponent(debateId)}?_t=${Date.now()}`);
        if (r2.ok) { const d2 = await r2.json(); setDebate(d2.debate); }
      } else {
        setToast({ message: data.error || 'Invite failed.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    } finally { setActionLoading(null); }
  }, [debateId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  // ── Loading / Not found ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-civic animate-spin" />
        </main>
        <MobileNav />
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary mb-4">Debate not found.</p>
            <Link href="/debates" className="text-sm text-civic-light hover:underline">Back to Debates</Link>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  const sideAParticipants = debate.participants.filter((p) => p.side === 'A');
  const sideBParticipants = debate.participants.filter((p) => p.side === 'B');

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="flex gap-0 lg:gap-4 max-w-6xl mx-auto">
        {/* ── Left column: Debate content ── */}
        <div className="flex-1 min-w-0 max-w-3xl">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/debates')} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-text-primary truncate">{debate.title}</h1>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span className={clsx(
                    'flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md',
                    debate.status === 'live' ? 'bg-danger/10 text-danger-light' :
                    debate.status === 'paused' ? 'bg-warning/10 text-warning-light' :
                    debate.status === 'waiting' ? 'bg-info/10 text-info-light' :
                    'bg-surface-active text-text-muted',
                  )}>
                    {debate.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />}
                    {debate.status.toUpperCase()}
                  </span>
                  {debate.status === 'live' && (
                    <span className="font-mono">Stage: {debate.stages[debate.currentStageIndex]}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                <Eye className="w-3.5 h-3.5" />
                {debate.spectatorCount}
              </div>
            </div>
          </header>

          {/* ── Live Timer Bar ── */}
          <div className="px-4 sm:px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className={clsx('w-4 h-4', debate.status === 'live' ? 'text-danger-light' : 'text-text-muted')} />
                <span className={clsx(
                  'text-2xl font-mono font-bold tracking-tight',
                  debate.status === 'live' ? 'text-text-primary' :
                  debate.status === 'paused' ? 'text-warning-light' : 'text-text-muted',
                )}>
                  {debate.status === 'waiting' ? formatTime(totalMs) : formatTime(remaining)}
                </span>
                <span className="text-xs text-text-muted">
                  {debate.status === 'waiting' ? 'total' : 'remaining'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">Elapsed</p>
                <p className="text-sm font-mono text-text-secondary">{formatTime(elapsed)}</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  progressPct > 90 ? 'bg-danger' : progressPct > 70 ? 'bg-warning' : 'bg-civic',
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* Stage indicators */}
            <div className="flex justify-between mt-2">
              {debate.stages.map((stage, i) => (
                <span
                  key={stage}
                  className={clsx(
                    'text-[10px] font-medium',
                    i === debate.currentStageIndex ? 'text-civic-light font-bold' :
                    i < debate.currentStageIndex ? 'text-positive-light' : 'text-text-muted',
                  )}
                >
                  {i < debate.currentStageIndex ? '✓ ' : ''}{stage}
                </span>
              ))}
            </div>
          </div>

          {/* ── Creator Controls ── */}
          {isCreator && (
            <div className="px-4 sm:px-6 py-3 border-b border-border-subtle bg-civic/3">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-warning" />
                <span className="text-xs font-semibold text-text-primary">Debate Host Controls</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Start / Resume */}
                {(debate.status === 'waiting' || debate.status === 'paused') && (
                  <button
                    onClick={() => doAction('start')}
                    disabled={actionLoading === 'start'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-positive text-white hover:bg-positive-light transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {debate.status === 'paused' ? 'Resume' : 'Start Debate'}
                  </button>
                )}
                {/* Pause */}
                {debate.status === 'live' && (
                  <button
                    onClick={() => doAction('pause')}
                    disabled={actionLoading === 'pause'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-warning text-white hover:bg-warning-light transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'pause' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                    Pause
                  </button>
                )}
                {/* Stop / End */}
                {debate.status !== 'completed' && debate.status !== 'waiting' && (
                  <button
                    onClick={() => doAction('stop')}
                    disabled={actionLoading === 'stop'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-danger text-white hover:bg-danger-light transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                    End Debate
                  </button>
                )}
                {/* Advance Stage */}
                {debate.status === 'live' && debate.currentStageIndex < debate.stages.length - 1 && (
                  <button
                    onClick={() => doAction('advance_stage')}
                    disabled={actionLoading === 'advance_stage'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-civic text-white hover:bg-civic-dark transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'advance_stage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                    Next Stage
                  </button>
                )}
                {/* Invite */}
                <button
                  onClick={() => setShowInvitePanel(!showInvitePanel)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    showInvitePanel
                      ? 'border-civic/40 bg-civic/10 text-civic-light'
                      : 'border-border-subtle text-text-secondary hover:text-civic-light hover:border-civic/30',
                  )}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite
                </button>
              </div>

              {/* ── Invite Panel ── */}
              {showInvitePanel && (
                <div className="mt-3 p-3 bg-surface-elevated rounded-xl border border-border-subtle animate-fade-in">
                  <p className="text-xs font-semibold text-text-primary mb-2">Invite to Debate</p>
                  <input
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-surface rounded-lg border border-border-subtle p-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40 mb-2"
                  />
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {inviteLoading && (
                      <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 text-text-muted animate-spin" /></div>
                    )}
                    {!inviteLoading && inviteableUsers.filter((u) =>
                      u.id !== currentUserId &&
                      !debate.participants.some((p) => p.userId === u.id) &&
                      !debate.kickedUserIds.includes(u.id)
                    ).map((u) => {
                      const isInvited = debate.invitedUserIds.includes(u.id);
                      const isLoadingInvite = actionLoading === 'invite-' + u.id;
                      return (
                        <div key={u.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-hover">
                          <span className="text-sm text-text-primary">{u.displayName}</span>
                          <button
                            onClick={() => handleInvite(u.id)}
                            disabled={isInvited || isLoadingInvite}
                            className={clsx(
                              'text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors',
                              isInvited
                                ? 'bg-positive/10 text-positive-light cursor-default'
                                : 'bg-civic/10 text-civic-light hover:bg-civic/20',
                            )}
                          >
                            {isLoadingInvite ? <Loader2 className="w-3 h-3 animate-spin" /> : isInvited ? '✓ Invited' : 'Invite'}
                          </button>
                        </div>
                      );
                    })}
                    {!inviteLoading && inviteableUsers.filter((u) =>
                      u.id !== currentUserId &&
                      !debate.participants.some((p) => p.userId === u.id) &&
                      !debate.kickedUserIds.includes(u.id)
                    ).length === 0 && (
                      <p className="text-xs text-text-muted py-2 text-center">
                        {inviteSearch ? 'No users found.' : 'No users available to invite.'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Description ── */}
          {debate.description && (
            <div className="px-4 sm:px-6 py-3 border-b border-border-subtle">
              <p className="text-sm text-text-secondary">{debate.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {debate.topics.map((topic) => (
                  <span key={topic} className="text-[11px] font-medium text-civic-light bg-civic/8 px-2 py-0.5 rounded-full">#{topic}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Sides & Participants ── */}
          <div className="px-4 sm:px-6 py-5">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
              {/* Side A */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-text-primary">{debate.sideA.label}</p>
                  <span className={clsx('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1', getAffStyle(debate.sideA.ideology))}>
                    {debate.sideA.ideology}
                  </span>
                </div>
                <div className="space-y-2">
                  {sideAParticipants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-[10px] font-bold text-civic-light">
                          {p.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-text-primary leading-tight">{p.displayName}</p>
                          {p.userId === debate.creatorId && (
                            <span className="text-[9px] text-warning flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" />Host</span>
                          )}
                        </div>
                      </div>
                      {isCreator && p.userId !== currentUserId && (
                        <button
                          onClick={() => doAction('kick', { targetUserId: p.userId })}
                          className="p-1 rounded text-text-muted hover:text-danger-light hover:bg-danger/10 transition-colors"
                          title="Remove from debate"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {sideAParticipants.length === 0 && (
                    <p className="text-xs text-text-muted text-center py-2">No debaters yet</p>
                  )}
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center justify-center gap-1">
                <ArrowLeftRight className="w-5 h-5 text-text-muted" />
                <span className="text-[10px] text-text-muted font-bold">VS</span>
              </div>

              {/* Side B */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-text-primary">{debate.sideB.label}</p>
                  <span className={clsx('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1', getAffStyle(debate.sideB.ideology))}>
                    {debate.sideB.ideology}
                  </span>
                </div>
                <div className="space-y-2">
                  {sideBParticipants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-[10px] font-bold text-civic-light">
                          {p.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-text-primary leading-tight">{p.displayName}</p>
                          {p.userId === debate.creatorId && (
                            <span className="text-[9px] text-warning flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" />Host</span>
                          )}
                        </div>
                      </div>
                      {isCreator && p.userId !== currentUserId && (
                        <button
                          onClick={() => doAction('kick', { targetUserId: p.userId })}
                          className="p-1 rounded text-text-muted hover:text-danger-light hover:bg-danger/10 transition-colors"
                          title="Remove from debate"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {sideBParticipants.length === 0 && (
                    <p className="text-xs text-text-muted text-center py-2">No debaters yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 mt-5 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{debate.spectatorCount} spectators</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{debate.participants.length} debaters</span>
              {debate.civilityScore > 0 && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  Civility: <span className="text-positive-light font-semibold">{Math.round(debate.civilityScore * 100)}%</span>
                </span>
              )}
            </div>
          </div>

          {/* ── Kicked Users (creator only) ── */}
          {isCreator && debate.kickedUserIds.length > 0 && (
            <div className="px-4 sm:px-6 pb-4">
              <div className="p-3 bg-danger/5 border border-danger/15 rounded-xl">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Removed Users</p>
                <div className="flex flex-wrap gap-1.5">
                  {debate.kickedUserIds.map((uid) => {
                    const knownUser = inviteableUsers.find((u) => u.id === uid);
                    return (
                      <span key={uid} className="text-[11px] text-danger-light bg-danger/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <X className="w-2.5 h-2.5" />
                        {knownUser?.displayName || uid}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Mobile: Chat/Voice toggle buttons ── */}
          <div className="lg:hidden px-4 sm:px-6 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShowMobilePanel(showMobilePanel === 'chat' ? null : 'chat')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors',
                  showMobilePanel === 'chat'
                    ? 'bg-civic/10 text-civic-light border-civic/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:bg-surface-hover',
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Live Chat
              </button>
              <button
                onClick={() => setShowMobilePanel(showMobilePanel === 'voice' ? null : 'voice')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg border transition-colors',
                  showMobilePanel === 'voice'
                    ? 'bg-positive/10 text-positive-light border-positive/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:bg-surface-hover',
                )}
              >
                <Mic className="w-3.5 h-3.5" />
                Voice Chat
              </button>
            </div>
          </div>

          {/* ── Mobile: Chat panel (below main content) ── */}
          {showMobilePanel === 'chat' && (
            <div className="lg:hidden px-4 sm:px-6 pb-4 animate-fade-in">
              <LiveChat
                debateId={debate.id}
                debateStatus={debate.status}
                isCreator={isCreator}
                currentUserId={currentUserId}
                spectatorCount={debate.spectatorCount}
                debaterCount={debate.participants.length}
              />
            </div>
          )}

          {/* ── Mobile: Voice panel (below main content) ── */}
          {showMobilePanel === 'voice' && (
            <div className="lg:hidden px-4 sm:px-6 pb-4 animate-fade-in">
              <VoiceChat
                debateId={debate.id}
                debateStatus={debate.status}
                isCreator={isCreator}
                isDebater={isDebater}
                currentUserId={currentUserId}
              />
            </div>
          )}

          <div className="h-20 lg:h-8" />
        </div>

        {/* ── Right column: Chat & Voice (desktop) ── */}
        <div className="hidden lg:flex flex-col gap-3 w-[340px] shrink-0 sticky top-0 h-screen py-4 pr-4 overflow-y-auto">
          <LiveChat
            debateId={debate.id}
            debateStatus={debate.status}
            isCreator={isCreator}
            currentUserId={currentUserId}
            spectatorCount={debate.spectatorCount}
            debaterCount={debate.participants.length}
          />
          <VoiceChat
            debateId={debate.id}
            debateStatus={debate.status}
            isCreator={isCreator}
            isDebater={isDebater}
            currentUserId={currentUserId}
          />
        </div>

        </div> {/* end flex row */}

        {/* Toast */}
        {toast && (
          <div className={clsx(
            'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-slide-up',
            toast.type === 'success' ? 'bg-positive text-white' : 'bg-danger text-white',
          )}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        )}
      </main>
      <MobileNav />
    </div>
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
