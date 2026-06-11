'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Camera,
  CameraOff,
  Video,
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
  const [joinLoading, setJoinLoading] = useState<'A' | 'B' | null>(null);

  // WebRTC streams from VoiceChat
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localWebRTCStream, setLocalWebRTCStream] = useState<MediaStream | null>(null);
  const [voiceCameraOn, setVoiceCameraOn] = useState(false);

  // ── Single VoiceChat instance, portaled between layouts ────
  // There must be EXACTLY ONE mounted VoiceChat per debate page.
  // The old markup rendered one in the mobile panel and one in the
  // desktop column, hidden via CSS — but CSS hiding doesn't unmount
  // React components, so BOTH WebRTC engines ran simultaneously:
  // they consumed each other's signals, sent competing offers under
  // the same userId, and overwrote the page's stream state through
  // the shared callbacks (which is why a debater could transmit
  // video the host saw, while their own preview tile stayed empty).
  // A portal moves the single instance between slots without
  // remounting it, so voice survives layout/panel changes.
  const [mobileVoiceSlot, setMobileVoiceSlot] = useState<HTMLDivElement | null>(null);
  const [desktopVoiceSlot, setDesktopVoiceSlot] = useState<HTMLDivElement | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)'); // Tailwind lg
    setIsDesktopLayout(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktopLayout(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mobile with the voice panel open → mobile slot. Everything else →
  // desktop slot (CSS-hidden below lg, which keeps voice running in
  // the background when the mobile panel is closed).
  const voiceSlot = !isDesktopLayout && showMobilePanel === 'voice' && mobileVoiceSlot
    ? mobileVoiceSlot
    : desktopVoiceSlot;

  // Overdrive: side-pick modal for invited users
  const [showSidePickModal, setShowSidePickModal] = useState(true);
  const wasInvitedRef = useRef(false);

  // Overdrive: join toast for new participants
  const [joinToast, setJoinToast] = useState<{ name: string; side: string; sideLabel: string } | null>(null);
  const seenParticipantIds = useRef<Set<string>>(new Set());

  const handleRemoteStreamsChange = useCallback((streams: Map<string, MediaStream>) => {
    setRemoteStreams(streams);
  }, []);
  const handleLocalStreamChange = useCallback((stream: MediaStream | null) => {
    setLocalWebRTCStream(stream);
  }, []);
  const handleCameraChange = useCallback((on: boolean) => {
    setVoiceCameraOn(on);
  }, []);

  const { elapsed, remaining, totalMs } = useLiveTimer(debate);
  const isCreator = !!currentUserId && debate?.creatorId === currentUserId;
  const isDebater = !!currentUserId && (debate?.participants.some((p) => p.userId === currentUserId) ?? false);
  const isInvited = !!currentUserId && (debate?.invitedUserIds.includes(currentUserId) ?? false);
  const isKicked = !!currentUserId && (debate?.kickedUserIds.includes(currentUserId) ?? false);
  const canJoin = !!currentUserId && !isDebater && !isKicked && debate?.status !== 'completed';
  const progressPct = totalMs > 0 ? Math.min(100, (elapsed / totalMs) * 100) : 0;
  const hasSpectatedRef = useRef(false);

  // ── Fetch debate ──
  const fetchDebate = useCallback(async () => {
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}?_t=${Date.now()}`);
      if (!res.ok) { setLoading(false); return; }
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

  // Auto-refresh debate state every 2s (only updates if data changed to avoid re-renders)
  const debateLoadedRef = useRef(false);
  useEffect(() => {
    if (!debate && !debateLoadedRef.current) return;
    debateLoadedRef.current = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          // Only update state if something actually changed (avoids re-renders that reset video/camera)
          setDebate((prev) => {
            if (!prev || !data.debate) return data.debate;
            const prevJson = JSON.stringify(prev);
            const nextJson = JSON.stringify(data.debate);
            return prevJson === nextJson ? prev : data.debate;
          });
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

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

  // ── Join debate (side selection) ────────────────────────────
  const handleJoin = useCallback(async (side: 'A' | 'B') => {
    setJoinLoading(side);
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', side }),
      });
      const data = await res.json();
      if (res.ok && data.debate) {
        setDebate(data.debate);
        setToast({ message: `Joined as ${side === 'A' ? debate?.sideA.label : debate?.sideB.label}!`, type: 'success' });
      } else {
        setToast({ message: data.error || 'Could not join debate.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    } finally { setJoinLoading(null); }
  }, [debateId, debate?.sideA.label, debate?.sideB.label]);

  // Detect when user newly becomes invited → re-show the side-pick modal
  useEffect(() => {
    if (isInvited && !wasInvitedRef.current && !isDebater) {
      setShowSidePickModal(true);
    }
    wasInvitedRef.current = isInvited;
  }, [isInvited, isDebater]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  // Overdrive: detect new participants and show join toast
  const joinToastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!debate?.participants) return;
    for (const p of debate.participants) {
      if (!seenParticipantIds.current.has(p.userId) && p.userId !== currentUserId) {
        seenParticipantIds.current.add(p.userId);
        if (!joinToast) {
          const sideLabel = p.side === 'A' ? debate.sideA.label : debate.sideB.label;
          setJoinToast({ name: p.displayName, side: p.side, sideLabel });
          if (joinToastTimeout.current) clearTimeout(joinToastTimeout.current);
          joinToastTimeout.current = setTimeout(() => setJoinToast(null), 3500);
        }
      } else {
        seenParticipantIds.current.add(p.userId);
      }
    }
  }, [debate?.participants, currentUserId, debate?.sideA.label, debate?.sideB.label, joinToast]);

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

  const sideAParticipants = debate?.participants.filter((p) => p.side === 'A') ?? [];
  const sideBParticipants = debate?.participants.filter((p) => p.side === 'B') ?? [];

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
              <button onClick={() => router.push('/debates')} className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-bold text-text-primary truncate">{debate.title}</h1>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className={clsx(
                    'flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md',
                    debate.status === 'live' ? 'bg-danger/10 text-danger-light' :
                    debate.status === 'paused' ? 'bg-warning/10 text-warning-light' :
                    debate.status === 'waiting' ? 'bg-info/10 text-info-light' :
                    'bg-surface-active text-text-muted',
                  )}>
                    {debate.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-live-glow" />}
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
                  'h-full rounded-full transition-colors duration-500',
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
                    'text-xs font-medium',
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-positive text-white hover:bg-positive-light transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-warning text-white hover:bg-warning-light transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-danger text-white hover:bg-danger-light transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-civic text-white hover:bg-civic-dark transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'advance_stage' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                    Next Stage
                  </button>
                )}
                {/* Invite */}
                <button
                  onClick={() => setShowInvitePanel(!showInvitePanel)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors',
                    showInvitePanel
                      ? 'border-civic/40 bg-civic-subtle text-civic-light'
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
                    className="w-full bg-surface rounded-xl border border-border-subtle p-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40 mb-2"
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
                        <div key={u.id} className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-surface-hover">
                          <span className="text-sm text-text-primary">{u.displayName}</span>
                          <button
                            onClick={() => handleInvite(u.id)}
                            disabled={isInvited || isLoadingInvite}
                            className={clsx(
                              'text-xs font-medium px-2.5 py-1 rounded-xl transition-colors',
                              isInvited
                                ? 'bg-positive/10 text-positive-light cursor-default'
                                : 'bg-civic-subtle text-civic-light hover:bg-civic-muted',
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
                  <span key={topic} className="text-xs font-medium text-civic-light bg-civic-subtle px-2 py-0.5 rounded-full">#{topic}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Join Debate CTA (inline — for non-invited users) ── */}
          {canJoin && debate && !isInvited && (
            <div className="px-4 sm:px-6 py-4 border-b border-border-subtle">
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm font-semibold text-text-primary mb-3">
                  Join this debate — pick a side:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(['A', 'B'] as const).map((side) => {
                    const sideData = side === 'A' ? debate.sideA : debate.sideB;
                    const count = side === 'A' ? sideAParticipants.length : sideBParticipants.length;
                    return (
                      <button
                        key={side}
                        onClick={() => handleJoin(side)}
                        disabled={!!joinLoading}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200',
                          'hover:border-civic/40 hover:bg-civic-subtle hover:-translate-y-0.5',
                          joinLoading === side ? 'border-civic/40 bg-civic-subtle' : 'border-border-subtle',
                        )}
                      >
                        {joinLoading === side ? (
                          <Loader2 className="w-5 h-5 text-civic animate-spin" />
                        ) : (
                          <>
                            <span className="text-sm font-bold text-text-primary">{sideData.label}</span>
                            <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', getAffStyle(sideData.ideology))}>{sideData.ideology}</span>
                            <span className="text-xs text-text-muted">{count} debater{count !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Overdrive: Invited User Side-Pick Modal ── */}
          {!loading && canJoin && debate && isInvited && !isDebater && showSidePickModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out forwards' }}>
              <div className="animate-spring-in bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-civic-muted flex items-center justify-center mx-auto mb-3">
                    <Mic className="w-7 h-7 text-civic-light" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary mb-1">You&apos;re invited!</h2>
                  <p className="text-sm text-text-muted">Choose a side to join the debate</p>
                  <p className="text-xs font-semibold text-civic-light mt-2 truncate">{debate.title}</p>
                </div>

                {/* Side cards */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {(['A', 'B'] as const).map((side, i) => {
                    const sideData = side === 'A' ? debate.sideA : debate.sideB;
                    const count = side === 'A' ? sideAParticipants.length : sideBParticipants.length;
                    return (
                      <button
                        key={side}
                        onClick={() => { handleJoin(side); setShowSidePickModal(false); }}
                        disabled={!!joinLoading}
                        className={clsx(
                          'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200',
                          'hover:border-civic/50 hover:bg-civic-subtle hover:-translate-y-1 hover:shadow-lg hover:shadow-civic/10',
                          'active:translate-y-0 active:scale-[0.98]',
                          joinLoading === side ? 'border-civic/40 bg-civic-subtle scale-[0.98]' : 'border-border-subtle',
                        )}
                        style={{ animationDelay: `${350 + i * 100}ms`, opacity: 0, animation: `springIn 0.5s var(--ease-decel) ${350 + i * 100}ms forwards` }}
                      >
                        {joinLoading === side ? (
                          <Loader2 className="w-6 h-6 text-civic animate-spin" />
                        ) : (
                          <>
                            <span className="text-base font-bold text-text-primary">{sideData.label}</span>
                            <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full', getAffStyle(sideData.ideology))}>{sideData.ideology}</span>
                            <span className="text-xs text-text-muted">{count} debater{count !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Skip */}
                <button
                  onClick={() => setShowSidePickModal(false)}
                  className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors py-2"
                >
                  Spectate instead
                </button>
              </div>
            </div>
          )}

          {/* ── Live Video Grid ── */}
          {debate.status !== 'completed' && debate.participants.length > 0 && (
            <DebateVideoGrid
              participants={debate.participants}
              sideA={debate.sideA}
              sideB={debate.sideB}
              currentUserId={currentUserId}
              creatorId={debate.creatorId}
              debateStatus={debate.status}
              remoteStreams={remoteStreams}
              localStream={localWebRTCStream}
              localCameraOn={voiceCameraOn}
            />
          )}

          {/* ── Sides & Participants ── */}
          <div className="px-4 sm:px-6 py-5">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
              {/* Side A */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-text-primary">{debate.sideA.label}</p>
                  <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1', getAffStyle(debate.sideA.ideology))}>
                    {debate.sideA.ideology}
                  </span>
                </div>
                <div className="space-y-2">
                  {sideAParticipants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-surface flex items-center justify-center text-xs font-bold text-civic-light">
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
                <span className="text-xs text-text-muted font-bold">VS</span>
              </div>

              {/* Side B */}
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4">
                <div className="text-center mb-3">
                  <p className="text-sm font-bold text-text-primary">{debate.sideB.label}</p>
                  <span className={clsx('inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1', getAffStyle(debate.sideB.ideology))}>
                    {debate.sideB.ideology}
                  </span>
                </div>
                <div className="space-y-2">
                  {sideBParticipants.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-surface flex items-center justify-center text-xs font-bold text-civic-light">
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
                <p className="text-xs font-semibold text-text-muted mb-1.5">Removed Users</p>
                <div className="flex flex-wrap gap-1.5">
                  {debate.kickedUserIds.map((uid) => {
                    const knownUser = inviteableUsers.find((u) => u.id === uid);
                    return (
                      <span key={uid} className="text-xs text-danger-light bg-danger/10 px-2 py-0.5 rounded-full flex items-center gap-1">
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
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors',
                  showMobilePanel === 'chat'
                    ? 'bg-civic-subtle text-civic-light border-civic/30'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:bg-surface-hover',
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Live Chat
              </button>
              <button
                onClick={() => setShowMobilePanel(showMobilePanel === 'voice' ? null : 'voice')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl border transition-colors',
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

          {/* ── Mobile: Voice panel slot (single VoiceChat portals here) ── */}
          {showMobilePanel === 'voice' && (
            <div
              ref={setMobileVoiceSlot}
              className="lg:hidden px-4 sm:px-6 pb-4 animate-fade-in"
            />
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
          {/* Desktop voice slot — also hosts the (CSS-hidden) instance on
              mobile when the panel is closed, so voice keeps running. */}
          <div ref={setDesktopVoiceSlot} />
        </div>

        </div> {/* end flex row */}

        {/* THE single VoiceChat instance. Portaled into whichever slot the
            current layout shows. Never render a second one — two engines
            consume each other's WebRTC signals and break video. */}
        {voiceSlot && createPortal(
          <VoiceChat
            debateId={debate.id}
            debateStatus={debate.status}
            isCreator={isCreator}
            isDebater={isDebater}
            currentUserId={currentUserId}
            onRemoteStreamsChange={handleRemoteStreamsChange}
            onLocalStreamChange={handleLocalStreamChange}
            onCameraChange={handleCameraChange}
          />,
          voiceSlot,
        )}

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

        {/* Overdrive: Participant joined toast */}
        {joinToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-join-toast">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface-elevated/95 backdrop-blur-md border border-border-subtle shadow-xl">
              <div className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                joinToast.side === 'A' ? 'bg-ideology-center-left/15 text-ideology-center-left' : 'bg-ideology-center-right/15 text-ideology-center-right',
              )}>
                {joinToast.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{joinToast.name}</p>
                <p className="text-xs text-text-muted">joined {joinToast.sideLabel}</p>
              </div>
              <UserPlus className="w-4 h-4 text-civic-light ml-2" />
            </div>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

// ─── Debate Video Grid ──────────────────────────────────────────
// Shows live camera feeds for debaters as they join and enable cameras.
// Slots only appear when a debater joins — empty by default.
// Smooth scale + fade animation when cameras turn on.

interface VideoGridProps {
  participants: Participant[];
  sideA: DebateSide;
  sideB: DebateSide;
  currentUserId: string;
  creatorId: string;
  debateStatus: 'waiting' | 'live' | 'paused' | 'completed';
  remoteStreams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  localCameraOn: boolean;
}

function DebateVideoGrid({ participants, sideA, sideB, currentUserId, creatorId, remoteStreams, localStream, localCameraOn }: VideoGridProps) {
  const sideAParticipants = participants.filter((p) => p.side === 'A');
  const sideBParticipants = participants.filter((p) => p.side === 'B');

  // Re-render when remote video tracks change (mute/unmute from replaceTrack,
  // or new tracks added via addTrack renegotiation)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const cleanup: Array<() => void> = [];
    const onTrackChange = () => forceUpdate((n) => n + 1);

    for (const stream of remoteStreams.values()) {
      // Listen for new tracks added to stream
      stream.addEventListener('addtrack', onTrackChange);
      stream.addEventListener('removetrack', onTrackChange);
      cleanup.push(() => {
        stream.removeEventListener('addtrack', onTrackChange);
        stream.removeEventListener('removetrack', onTrackChange);
      });
      // Listen for mute/unmute on existing video tracks
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('mute', onTrackChange);
        track.addEventListener('unmute', onTrackChange);
        cleanup.push(() => {
          track.removeEventListener('mute', onTrackChange);
          track.removeEventListener('unmute', onTrackChange);
        });
      }
    }
    return () => cleanup.forEach((fn) => fn());
  }, [remoteStreams]);

  // Check if a stream has an active video track.
  // For remote tracks, `muted` starts as true until media data actually flows
  // (this is the WebRTC "muted" flag, NOT user-initiated mute). We treat
  // readyState === 'live' as sufficient — the video element will display
  // frames as soon as they arrive, even if `muted` is initially true.
  function hasActiveVideo(stream: MediaStream | null): boolean {
    if (!stream) return false;
    const vt = stream.getVideoTracks()[0];
    return !!vt && vt.readyState === 'live';
  }

  // Count how many participants have active video
  const activeVideoCount = (localCameraOn ? 1 : 0) + Array.from(remoteStreams.values()).filter(hasActiveVideo).length;

  if (participants.length === 0) return null;

  // Get the video stream for a given participant
  function getStreamFor(userId: string): MediaStream | null {
    if (userId === currentUserId) return localCameraOn ? localStream : null;
    return remoteStreams.get(userId) ?? null;
  }

  function hasVideoFor(userId: string): boolean {
    return hasActiveVideo(getStreamFor(userId));
  }

  return (
    <div className="px-4 sm:px-6 py-4 border-b border-border-subtle">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-civic-light" />
          <span className="text-xs font-semibold text-text-primary">Live Cameras</span>
          <span className="text-xs text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full">
            {activeVideoCount > 0 ? `${activeVideoCount} live` : `${participants.length} debaters`}
          </span>
        </div>
        <span className="text-xs text-text-muted">
          Toggle camera in Voice Chat below
        </span>
      </div>

      {/* Two-column layout: Side A | Side B */}
      <div className="grid grid-cols-2 gap-4">
        {/* Side A */}
        <div>
          <p className="text-xs font-semibold text-text-muted mb-2 text-center">
            {sideA.label}
          </p>
          <div className={clsx(
            'grid gap-2',
            sideAParticipants.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}>
            {sideAParticipants.slice(0, 4).map((p, i) => (
              <VideoSlot
                key={p.userId}
                participant={p}
                side="A"
                index={i}
                isMe={p.userId === currentUserId}
                isHost={p.userId === creatorId}
                cameraOn={hasVideoFor(p.userId)}
                videoStream={getStreamFor(p.userId)}
              />
            ))}
          </div>
          {sideAParticipants.length === 0 && (
            <p className="text-xs text-text-muted/40 text-center py-6">No debaters yet</p>
          )}
        </div>

        {/* Side B */}
        <div>
          <p className="text-xs font-semibold text-text-muted mb-2 text-center">
            {sideB.label}
          </p>
          <div className={clsx(
            'grid gap-2',
            sideBParticipants.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          )}>
            {sideBParticipants.slice(0, 4).map((p, i) => (
              <VideoSlot
                key={p.userId}
                participant={p}
                side="B"
                index={i}
                isMe={p.userId === currentUserId}
                isHost={p.userId === creatorId}
                cameraOn={hasVideoFor(p.userId)}
                videoStream={getStreamFor(p.userId)}
              />
            ))}
          </div>
          {sideBParticipants.length === 0 && (
            <p className="text-xs text-text-muted/40 text-center py-6">No debaters yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Individual video slot with enter/camera animations ─────────

function VideoSlot({
  participant,
  side,
  index,
  isMe,
  isHost,
  cameraOn,
  videoStream,
}: {
  participant: Participant;
  side: 'A' | 'B';
  index: number;
  isMe: boolean;
  isHost: boolean;
  cameraOn: boolean;
  videoStream: MediaStream | null;
}) {
  const [entered, setEntered] = useState(false);
  const [cameraRevealed, setCameraRevealed] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevCameraOn = useRef(false);

  const initials = participant.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2);

  // Staggered slot entrance animation
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80 + index * 150);
    return () => clearTimeout(t);
  }, [index]);

  // Wire video element to stream.
  // Depend on both videoStream and cameraOn because the <video> element
  // is conditionally rendered (mounts when cameraOn becomes true).
  // We need to set srcObject after the element enters the DOM.
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, cameraOn]);

  // Camera reveal + flash animation
  useEffect(() => {
    if (cameraOn && videoStream) {
      const t = setTimeout(() => {
        setCameraRevealed(true);
        // Flash only on first camera activation
        if (!prevCameraOn.current) {
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 700);
        }
        prevCameraOn.current = true;
      }, 100);
      return () => clearTimeout(t);
    } else {
      setCameraRevealed(false);
      prevCameraOn.current = false;
    }
  }, [cameraOn, videoStream]);

  return (
    <div
      className={clsx(
        'relative aspect-video rounded-xl overflow-hidden transition-all duration-500',
        entered ? 'opacity-100 scale-100' : 'opacity-0 scale-90',
        showFlash && 'animate-camera-flash',
        cameraRevealed
          ? 'border-2 border-civic/40 shadow-[0_0_20px_rgba(194,168,120,0.15)]'
          : 'border-2 border-border-subtle',
      )}
      style={{ transitionTimingFunction: 'var(--ease-spring)' }}
    >
      {/* Camera feed — fades in smoothly */}
      {cameraOn && videoStream ? (
        <div className={clsx(
          'absolute inset-0 transition-all duration-700 ease-out',
          cameraRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
        )}>
          <video
            ref={videoRef}
            autoPlay
            muted={isMe}
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}

      {/* Placeholder (initials) — visible when camera is off */}
      <div className={clsx(
        'absolute inset-0 flex flex-col items-center justify-center bg-surface-elevated transition-all duration-500',
        cameraRevealed ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
      )}>
        <div className={clsx(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold mb-2 transition-colors duration-300',
          side === 'A' ? 'bg-ideology-center-left/15 text-ideology-center-left' : 'bg-ideology-center-right/15 text-ideology-center-right',
        )}>
          {initials}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <CameraOff className="w-3 h-3" />
          Camera off
        </div>
      </div>

      {/* Name overlay — slides up on entrance */}
      <div
        className={clsx(
          'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 py-2 z-10 transition-all duration-300',
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        )}
        style={{ transitionDelay: `${200 + index * 150}ms` }}
      >
        <div className="flex items-center gap-1.5">
          {isHost && <Crown className="w-3 h-3 text-warning shrink-0" />}
          <span className="text-xs font-medium text-white truncate">
            {isMe ? 'You' : participant.displayName}
          </span>
          {cameraRevealed && (
            <span className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-positive animate-breathe" />
              <span className="text-[9px] text-positive-light font-medium">LIVE</span>
            </span>
          )}
        </div>
      </div>
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
