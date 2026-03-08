'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Layers,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Award,
  BadgeCheck,
  MessageCircle,
  Users,
  Check,
  TrendingUp,
  X,
  BarChart3,
  Flag,
  Trash2,
  MoreHorizontal,
  LogIn,
  LinkIcon,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { CredibilityMeter, type CredibilityData } from './credibility-meter';
import { ContextPanel } from './context-panel';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { useAuth } from '@/lib/auth-context';
import { MentionText } from '@/components/ui/mention-text';
import { analyzeCivility } from '@/lib/civility';

// ─── Types ───────────────────────────────────────────────────

interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  affiliations: string[];
  verificationLevel: string;
  civicReputation?: number;
}

interface PostSource {
  url: string;
  domain: string;
  trustScore: number;
}

interface PostReactions {
  agree: number;
  disagree: number;
  insightful: number;
  nuance: number;
}

interface PostThread {
  id: string;
  type: string;
  topics: string[];
  participantCount: number;
  civilityScore: number;
  diversityScore: number;
}

interface PostAlgorithm {
  qualityScore: number;
  signals: {
    engagementQuality: number;
    civility: number;
    viewpointDiversity: number;
    sourceCredibility: number;
    topicRelevance: number;
    authorReputation: number;
    penalty: number;
  };
  explanation: string;
  explanationTags: string[];
}

interface PostReply {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  civilityScore: number;
  reactions: { agree: number; disagree: number; insightful: number };
}

export interface PostData {
  id: string;
  content: string;
  createdAt: string;
  topics: string[];
  author: PostAuthor;
  thread: PostThread | null;
  sources: PostSource[];
  reactions: PostReactions;
  algorithm: PostAlgorithm;
  replies: PostReply[];
  comment_policy?: 'everyone' | 'followers_only' | 'off';
  comment_count?: number;
  is_thread_locked?: boolean;
  postType?: string;
  _optimistic?: boolean;
  _failed?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

const ideologyColors: Record<string, string> = {
  left: 'bg-ideology-left/15 text-ideology-left',
  'center-left': 'bg-ideology-center-left/15 text-ideology-center-left',
  center: 'bg-ideology-center/15 text-ideology-center',
  'center-right': 'bg-ideology-center-right/15 text-ideology-center-right',
  right: 'bg-ideology-right/15 text-ideology-right',
};

const verificationIcons: Record<string, { icon: typeof ShieldCheck; label: string; color: string }> = {
  EXPERT_VERIFIED: { icon: Award, label: 'Verified Expert', color: 'text-positive' },
  CITIZEN_VERIFIED: { icon: BadgeCheck, label: 'Verified Citizen', color: 'text-info' },
  EMAIL_VERIFIED: { icon: ShieldCheck, label: 'Verified', color: 'text-text-muted' },
  OFFICIAL_VERIFIED: { icon: Award, label: 'Verified Official', color: 'text-warning' },
};

const threadTypeLabels: Record<string, { label: string; color: string }> = {
  POLICY_PROPOSAL: { label: 'Policy Proposal', color: 'bg-positive/10 text-positive-light' },
  STRUCTURED_DEBATE: { label: 'Structured Debate', color: 'bg-warning/10 text-warning-light' },
  CROSS_PARTY_ROUNDTABLE: { label: 'Cross-Party Roundtable', color: 'bg-civic/10 text-civic-light' },
  EXPERT_AMA: { label: 'Expert Q&A', color: 'bg-info/10 text-info-light' },
  NEWS_DISCUSSION: { label: 'News Discussion', color: 'bg-danger/10 text-danger-light' },
  OPEN_DISCUSSION: { label: 'Discussion', color: 'bg-surface-active text-text-secondary' },
};

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function buildCredibilityData(post: PostData): CredibilityData {
  return {
    sourceCredibility: post.algorithm.signals.sourceCredibility,
    authorReputation: post.algorithm.signals.authorReputation,
    civility: post.algorithm.signals.civility,
    penalty: post.algorithm.signals.penalty,
    sourceCount: post.sources.length,
    hasPrimarySources: post.sources.some((s) => s.trustScore >= 0.9),
    verificationLevel: post.author.verificationLevel,
    flagCount: post.algorithm.signals.penalty > 0.2 ? Math.round(post.algorithm.signals.penalty * 15) : 0,
  };
}

type ReactionType = 'agree' | 'disagree' | 'insightful' | 'nuance';

// ─── Toast Component ─────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return createPortal(
    <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg text-sm text-text-primary animate-slide-up">
      {message}
    </div>,
    document.body,
  );
}

// ─── Post Card Component ─────────────────────────────────────

export const PostCard = memo(function PostCard({ post, index, onDelete }: { post: PostData; index: number; onDelete?: (postId: string) => void }) {
  const { isAuthenticated, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Reaction state (server-authoritative)
  const [viewerReaction, setViewerReaction] = useState<ReactionType | null>(null);
  const [reactionDeltas, setReactionDeltas] = useState<Record<ReactionType, number>>({ agree: 0, disagree: 0, insightful: 0, nuance: 0 });
  const [reactionLoading, setReactionLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState<ReactionType | null>(null);
  const [hasFeedback, setHasFeedback] = useState(false);

  const isOwnPost = Boolean(user && post.author.id === user.id);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click (works on mobile via pointerdown)
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showMoreMenu]);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteConfirm(false);
        onDelete?.(post.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || `Delete failed (${res.status}).`);
      }
    } catch {
      setDeleteError('Network error — could not reach server.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Reaction handler (calls server) ────────────────────────
  const handleReaction = useCallback(async (e: React.MouseEvent, reaction: ReactionType) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      setToast('Please log in to react to posts');
      return;
    }
    if (reactionLoading) return;

    // Optimistic update
    const prevReaction = viewerReaction;
    const prevDeltas = { ...reactionDeltas };

    const newDeltas = { ...reactionDeltas };
    if (prevReaction === reaction) {
      // Toggle off
      setViewerReaction(null);
      newDeltas[reaction] = Math.max(0, newDeltas[reaction] - 1);
    } else {
      // Switch or add
      if (prevReaction) newDeltas[prevReaction] = Math.max(0, newDeltas[prevReaction] - 1);
      newDeltas[reaction] = newDeltas[reaction] + 1;
      setViewerReaction(reaction);
    }
    setReactionDeltas(newDeltas);

    setReactionLoading(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });

      if (res.ok) {
        const data = await res.json();
        setViewerReaction(data.viewer_reaction);
        setReactionDeltas(data.deltas);
        setHasFeedback(data.has_feedback);

        // Show feedback panel for agree/disagree on first reaction
        if (data.viewer_reaction && !data.has_feedback &&
            (data.viewer_reaction === 'agree' || data.viewer_reaction === 'disagree')) {
          setShowFeedback(data.viewer_reaction);
        }
      } else if (res.status === 401) {
        setToast('Please log in to react to posts');
        setViewerReaction(prevReaction);
        setReactionDeltas(prevDeltas);
      } else {
        // Rollback
        setViewerReaction(prevReaction);
        setReactionDeltas(prevDeltas);
        setToast('Failed to save reaction');
      }
    } catch {
      setViewerReaction(prevReaction);
      setReactionDeltas(prevDeltas);
      setToast('Network error — please try again');
    } finally {
      setReactionLoading(false);
    }
  }, [isAuthenticated, viewerReaction, reactionDeltas, reactionLoading, post.id]);

  // ── Share handler ──────────────────────────────────────────
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const url = `${window.location.origin}/post/${encodeURIComponent(post.id)}`;
    const title = `${post.author.displayName} on Civic Social`;
    const text = post.content.slice(0, 140) + (post.content.length > 140 ? '...' : '');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied to clipboard');
    } catch {
      setToast('Could not copy link');
    }
  }, [post.id, post.author.displayName, post.content]);

  // ── Feedback submit handler ────────────────────────────────
  const handleFeedbackSubmit = useCallback(async (reasons: string[]) => {
    try {
      await fetch(`/api/posts/${encodeURIComponent(post.id)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'feedback',
          reaction: showFeedback,
          reasons,
        }),
      });
      setHasFeedback(true);
    } catch {
      // Feedback submission is best-effort
    }
    setShowFeedback(null);
  }, [post.id, showFeedback]);

  const verification = verificationIcons[post.author.verificationLevel];
  const threadType = post.thread ? threadTypeLabels[post.thread.type] : null;
  const postTypeLabel = !threadType && post.postType && post.postType !== 'OPEN_DISCUSSION'
    ? threadTypeLabels[post.postType] || null
    : null;
  const displayType = threadType || postTypeLabel;
  const ideology = post.author.affiliations[0];
  const ideologyStyle = ideology ? ideologyColors[ideology] : '';
  const credibilityData = buildCredibilityData(post);

  const isLong = post.content.length > 300;
  const displayContent = isLong && !expanded ? post.content.slice(0, 300) + '...' : post.content;

  // Merged counts = base (from mock data) + deltas (from real reactions)
  const counts: Record<ReactionType, number> = {
    agree: post.reactions.agree + reactionDeltas.agree,
    disagree: post.reactions.disagree + reactionDeltas.disagree,
    insightful: post.reactions.insightful + reactionDeltas.insightful,
    nuance: post.reactions.nuance + reactionDeltas.nuance,
  };

  return (
    <article
      className={clsx(
        'feed-item animate-fade-in opacity-0 border-b border-border-subtle hover:bg-surface/40 transition-colors duration-150',
        post._optimistic && 'opacity-70',
        post._failed && 'opacity-50 border-l-2 border-l-danger',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
    >
      {post._optimistic && (
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center gap-1.5 text-[11px] text-text-muted">
          <div className="w-3 h-3 border-2 border-civic/40 border-t-civic rounded-full animate-spin" />
          Posting...
        </div>
      )}
      {post._failed && (
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center gap-1.5 text-[11px] text-danger-light">
          <span className="font-semibold">Failed to post</span>
          <span className="text-text-muted">— tap to retry or dismiss</span>
        </div>
      )}
      <div className="px-4 sm:px-6 py-5">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-3">
          <Link
            href={`/profile/${encodeURIComponent(post.author.id)}`}
            className="w-10 h-10 rounded-full shrink-0 hover:ring-2 hover:ring-civic/20 transition-all cursor-pointer overflow-hidden"
          >
            {post.author.avatarUrl ? (
              <img src={post.author.avatarUrl} alt={post.author.displayName} className="w-10 h-10 rounded-full object-cover border border-border-subtle" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-sm font-semibold border border-border-subtle">
                {post.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profile/${encodeURIComponent(post.author.id)}`}
                className="font-semibold text-sm text-text-primary hover:text-civic-light hover:underline transition-colors"
              >
                {post.author.displayName}
              </Link>
              {verification && (
                <span title={verification.label}>
                  <verification.icon className={clsx('w-3.5 h-3.5', verification.color)} />
                </span>
              )}
              {ideology && (
                <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', ideologyStyle)}>
                  {ideology}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
              {displayType && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-md', displayType.color)}>
                    {displayType.label}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setShowAlgorithm(!showAlgorithm); }}
              title="Click to see why this post ranks here"
            >
              <div
                className={clsx(
                  'text-[10px] font-mono font-bold px-2 py-1 rounded-md',
                  post.algorithm.qualityScore >= 0.6
                    ? 'bg-positive/10 text-positive-light'
                    : post.algorithm.qualityScore >= 0.3
                      ? 'bg-warning/10 text-warning-light'
                      : 'bg-danger/10 text-danger-light',
                )}
              >
                Q: {post.algorithm.qualityScore.toFixed(3)}
              </div>
            </div>

            {isOwnPost && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
                  className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="More options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated rounded-xl border border-border-subtle shadow-lg z-50 animate-fade-in overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-danger-light hover:bg-danger/5 transition-colors text-left min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Content (clickable → thread view) ── */}
        <div className="ml-[52px]">
          <div
            role="link"
            tabIndex={0}
            onClick={(e) => {
              // Don't navigate if user clicked a link inside (e.g. @mention)
              if ((e.target as HTMLElement).closest('a')) return;
              window.location.href = `/post/${encodeURIComponent(post.id)}`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !(e.target as HTMLElement).closest('a')) {
                window.location.href = `/post/${encodeURIComponent(post.id)}`;
              }
            }}
            className="block text-[14.5px] leading-relaxed text-text-primary whitespace-pre-line hover:text-text-primary/90 transition-colors cursor-pointer"
          >
            <MentionText text={displayContent} />
          </div>
          {isLong && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-civic-light text-sm font-medium mt-1 hover:underline flex items-center gap-1 min-h-[44px]"
            >
              {expanded ? (
                <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Read more <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}

          {post.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/hashtag/${encodeURIComponent(topic)}`}
                  className="text-[11px] font-medium text-civic-light bg-civic/8 px-2 py-0.5 rounded-full hover:bg-civic/15 transition-colors cursor-pointer"
                >
                  #{topic}
                </Link>
              ))}
            </div>
          )}

          <CredibilityMeter data={credibilityData} />
          <ContextPanel topics={post.topics} />

          {post.sources.length > 0 && (
            <div className="mt-3 space-y-1">
              {post.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-text-secondary hover:text-civic-light transition-colors group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 text-text-muted group-hover:text-civic-light" />
                  <span className="truncate">{source.domain}</span>
                  <span
                    className={clsx(
                      'text-[9px] font-semibold px-1 py-0.5 rounded',
                      source.trustScore >= 0.8 ? 'bg-positive/10 text-positive-light'
                        : source.trustScore >= 0.5 ? 'bg-warning/10 text-warning-light'
                          : 'bg-danger/10 text-danger-light',
                    )}
                  >
                    Trust: {Math.round(source.trustScore * 100)}%
                  </span>
                </a>
              ))}
            </div>
          )}

          {post.thread && (
            <div className="mt-3 flex items-center gap-3 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{post.thread.participantCount} participants</span>
              <span className="flex items-center gap-1">
                Civility: <span className={clsx('font-semibold', post.thread.civilityScore >= 0.7 ? 'text-civility-high' : post.thread.civilityScore >= 0.4 ? 'text-civility-medium' : 'text-civility-low')}>
                  {Math.round(post.thread.civilityScore * 100)}%
                </span>
              </span>
              <span className="flex items-center gap-1">
                Diversity: <span className="font-semibold text-civic-light">{Math.round(post.thread.diversityScore * 100)}%</span>
              </span>
            </div>
          )}

          {/* ── Reactions Bar ── */}
          <div className="flex items-center gap-1 mt-4 flex-wrap">
            {([
              { type: 'agree' as ReactionType, icon: ThumbsUp, label: 'Agree', color: 'text-positive', bgActive: 'bg-positive/15' },
              { type: 'disagree' as ReactionType, icon: ThumbsDown, label: 'Disagree', color: 'text-danger', bgActive: 'bg-danger/15' },
              { type: 'insightful' as ReactionType, icon: Lightbulb, label: 'Insightful', color: 'text-warning', bgActive: 'bg-warning/15' },
              { type: 'nuance' as ReactionType, icon: Layers, label: 'Nuance', color: 'text-civic-light', bgActive: 'bg-civic/15' },
            ]).map((btn) => {
              const isActive = viewerReaction === btn.type;
              return (
                <button
                  key={btn.type}
                  onClick={(e) => handleReaction(e, btn.type)}
                  disabled={reactionLoading}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg transition-all duration-150 min-h-[44px] active:scale-95 select-none',
                    isActive
                      ? `${btn.color} ${btn.bgActive} font-semibold`
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                    reactionLoading && 'opacity-60',
                  )}
                  title={btn.label}
                >
                  <btn.icon className="w-4 h-4" />
                  <span>{formatNumber(counts[btn.type])}</span>
                </button>
              );
            })}

            <div className="flex-1" />

            <Link
              href={`/post/${post.id}`}
              onClick={(e) => {
                if (post.comment_policy === 'off' || post.is_thread_locked) e.preventDefault();
                e.stopPropagation();
              }}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg transition-colors min-h-[44px]',
                post.comment_policy === 'off' || post.is_thread_locked
                  ? 'text-text-muted/50 cursor-default'
                  : 'text-text-muted hover:text-civic-light hover:bg-surface-hover',
              )}
              title={
                post.is_thread_locked ? 'Thread locked' :
                post.comment_policy === 'off' ? 'Comments turned off' :
                'Reply'
              }
            >
              <MessageCircle className="w-4 h-4" />
              {(() => {
                const count = post.comment_count ?? post.replies?.length ?? 0;
                return count > 0 ? count : 'Reply';
              })()}
            </Link>

            <button
              onClick={(e) => { e.stopPropagation(); setBookmarked(!bookmarked); }}
              className={clsx(
                'p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                bookmarked ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title={bookmarked ? 'Remove bookmark' : 'Save post'}
            >
              {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowReport(!showReport); }}
              className={clsx(
                'p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                showReport ? 'text-danger-light bg-danger/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Report content"
            >
              <Flag className="w-4 h-4" />
            </button>
            <button
              onClick={handleShare}
              className="p-2.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAlgorithm(!showAlgorithm); }}
              className={clsx(
                'p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                showAlgorithm ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Why am I seeing this?"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* ── Feedback Modal (portal) ── */}
          {showFeedback && (
            <FeedbackModal
              reactionType={showFeedback}
              onSubmit={handleFeedbackSubmit}
              onSkip={() => setShowFeedback(null)}
            />
          )}

          {showReport && <InlineReportPanel postId={post.id} onClose={() => setShowReport(false)} />}
          {showAlgorithm && <AlgorithmExplainer algorithm={post.algorithm} postContent={post.content} />}
          {showReplies && post.replies.length > 0 && (
            <div className="mt-4 space-y-3 border-l-2 border-border-subtle pl-4 animate-fade-in">
              {post.replies.map((reply) => <ReplyCard key={reply.id} reply={reply} />)}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { if (!deleting) { setShowDeleteConfirm(false); setDeleteError(null); } }}
        onConfirm={handleDelete}
        deleting={deleting}
        contentPreview={post.content}
        error={deleteError}
      />
    </article>
  );
});

// ═══════════════════════════════════════════════════════════════
// Feedback Modal (Portal-based bottom sheet)
// ═══════════════════════════════════════════════════════════════

const FEEDBACK_REASONS: Record<string, { id: string; label: string }[]> = {
  agree: [
    { id: 'well-sourced', label: 'Well-sourced & cited' },
    { id: 'solution-oriented', label: 'Solution-oriented thinking' },
    { id: 'changed-perspective', label: 'Changed my perspective' },
    { id: 'fair-to-all', label: 'Fair to all sides' },
    { id: 'expert-analysis', label: 'Expert-level analysis' },
    { id: 'strong-evidence', label: 'Strong evidence presented' },
  ],
  disagree: [
    { id: 'missing-sources', label: 'Missing credible sources' },
    { id: 'misleading-claims', label: 'Contains misleading claims' },
    { id: 'ignores-counter', label: 'Ignores counter-arguments' },
    { id: 'one-sided', label: 'One-sided perspective' },
    { id: 'inflammatory', label: 'Inflammatory language' },
    { id: 'logical-fallacy', label: 'Logical fallacy' },
  ],
};

function FeedbackModal({
  reactionType,
  onSubmit,
  onSkip,
}: {
  reactionType: ReactionType;
  onSubmit: (reasons: string[]) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const reasons = FEEDBACK_REASONS[reactionType] || FEEDBACK_REASONS.agree;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setSubmitted(true);
    onSubmit(Array.from(selected));
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const isAgree = reactionType === 'agree';
  const title = isAgree ? 'Why do you agree?' : 'Why do you disagree?';
  const Icon = isAgree ? ThumbsUp : ThumbsDown;
  const color = isAgree ? 'text-positive-light' : 'text-danger-light';

  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onSkip} />
        <div className="relative bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 pb-safe text-center animate-slide-up">
          <div className="w-12 h-12 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-positive-light" />
          </div>
          <p className="text-base font-semibold text-text-primary mb-1">Thanks for your feedback!</p>
          <p className="text-sm text-text-muted mb-4">Your input helps improve content ranking for everyone.</p>
          <button
            onClick={onSkip}
            className="px-6 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
          >
            Done
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onSkip} />
      <div className="relative bg-bg rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Icon className={clsx('w-5 h-5', color)} />
            <span className={clsx('text-sm font-semibold', color)}>{title}</span>
          </div>
          <button
            onClick={onSkip}
            className="p-2 -mr-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        <div className="px-5 pb-5 space-y-2">
          {reasons.map((reason) => {
            const isSelected = selected.has(reason.id);
            return (
              <button
                key={reason.id}
                onClick={() => toggle(reason.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all min-h-[48px] active:scale-[0.98]',
                  isSelected
                    ? 'bg-civic/10 border border-civic/30 text-text-primary font-medium'
                    : 'bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-surface-hover',
                )}
              >
                <div className={clsx(
                  'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                  isSelected ? 'bg-civic border-civic text-white' : 'border-border-strong',
                )}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
                <span>{reason.label}</span>
              </button>
            );
          })}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onSkip}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors min-h-[44px]"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0}
              className={clsx(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px]',
                selected.size > 0
                  ? 'bg-civic text-white hover:bg-civic-dark'
                  : 'bg-surface-active text-text-muted cursor-not-allowed',
              )}
            >
              Submit ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components (Algorithm, Report, Reply)
// ═══════════════════════════════════════════════════════════════

function AlgorithmExplainer({ algorithm, postContent }: { algorithm: PostAlgorithm; postContent: string }) {
  const signals = algorithm.signals;
  const civility = analyzeCivility(postContent);

  return (
    <div className="mt-4 p-4 bg-surface-elevated rounded-xl border border-border-subtle animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-civic-light" />
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Why am I seeing this?</h4>
      </div>
      <p className="text-sm text-text-secondary mb-4">{algorithm.explanation}</p>
      <div className="space-y-2">
        <SignalBar label="Civility" value={signals.civility} weight="25%" color="bg-positive" />
        <SignalBar label="Engagement Quality" value={signals.engagementQuality} weight="20%" color="bg-info" />
        <SignalBar label="Viewpoint Diversity" value={signals.viewpointDiversity} weight="15%" color="bg-civic" />
        <SignalBar label="Source Credibility" value={signals.sourceCredibility} weight="15%" color="bg-warning" />
        <SignalBar label="Topic Relevance" value={signals.topicRelevance} weight="15%" color="bg-civic-light" />
        <SignalBar label="Author Reputation" value={signals.authorReputation} weight="10%" color="bg-info-light" />
        {signals.penalty > 0 && <SignalBar label="Penalty" value={signals.penalty} weight="SUB" color="bg-danger" isNegative />}
      </div>

      {/* Civility breakdown — shows specific issues that lowered the score */}
      {civility.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-warning-light" />
            <span className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">
              Civility Issues ({Math.round(civility.score * 100)}%)
            </span>
          </div>
          <div className="space-y-1.5">
            {civility.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <AlertTriangle className="w-3 h-3 text-warning-light mt-0.5 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {civility.issues.length === 0 && civility.score >= 0.8 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-positive-light" />
            <span className="text-[11px] text-positive-light font-medium">
              This post promotes constructive civic discourse
            </span>
          </div>
        </div>
      )}

      {algorithm.explanationTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-subtle">
          {algorithm.explanationTags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium text-text-muted bg-surface-active px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalBar({ label, value, weight, color, isNegative }: { label: string; value: number; weight: string; color: string; isNegative?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-text-muted w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className={clsx('text-[11px] font-mono w-10 text-right', isNegative ? 'text-danger-light' : 'text-text-secondary')}>
        {isNegative ? '-' : ''}{Math.round(value * 100)}%
      </span>
      <span className="text-[9px] text-text-muted w-8 text-right">{weight}</span>
    </div>
  );
}

const REPORT_CATEGORIES = [
  { id: 'threats', label: 'Threats or violence', severity: 'high' },
  { id: 'harassment', label: 'Harassment or bullying', severity: 'high' },
  { id: 'misinfo', label: 'Misinformation / misleading', severity: 'medium' },
  { id: 'hate', label: 'Hate speech or extremism', severity: 'high' },
  { id: 'spam', label: 'Spam or manipulation', severity: 'medium' },
  { id: 'impersonation', label: 'Impersonation', severity: 'medium' },
  { id: 'other', label: 'Other', severity: 'low' },
];

function InlineReportPanel({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-3 p-4 bg-surface-elevated rounded-xl border border-border-subtle animate-slide-up">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center">
            <Check className="w-4 h-4 text-positive-light" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Report submitted</p>
            <p className="text-[11px] text-text-muted">Our moderation team will review within 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-danger-light" />
          <span className="text-xs font-semibold text-text-primary">Report Content</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-1.5">
        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={(e) => { e.stopPropagation(); setSelected(cat.id); }}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs transition-all min-h-[44px]',
              selected === cat.id
                ? 'bg-civic/10 border border-civic/30 text-text-primary'
                : 'bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover',
            )}
          >
            <div className={clsx('w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0', selected === cat.id ? 'bg-civic border-civic' : 'border-border-strong')}>
              {selected === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            {cat.label}
          </button>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); if (selected) setSubmitted(true); }}
          disabled={!selected}
          className={clsx(
            'w-full mt-2 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[44px]',
            selected ? 'bg-danger text-white hover:bg-danger/80' : 'bg-surface-active text-text-muted cursor-not-allowed',
          )}
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}

function ReplyCard({ reply }: { reply: PostReply }) {
  const verification = verificationIcons[reply.author.verificationLevel];
  const ideology = reply.author.affiliations[0];
  const ideologyStyle = ideology ? ideologyColors[ideology] : '';

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-1">
        {reply.author.avatarUrl ? (
          <img src={reply.author.avatarUrl} alt={reply.author.displayName} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-surface-active flex items-center justify-center text-text-muted text-[10px] font-semibold">
            {reply.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
        )}
        <span className="text-xs font-semibold text-text-primary">{reply.author.displayName}</span>
        {verification && <verification.icon className={clsx('w-3 h-3', verification.color)} />}
        {ideology && <span className={clsx('text-[9px] font-medium px-1 py-0.5 rounded-full', ideologyStyle)}>{ideology}</span>}
        <span className="text-[11px] text-text-muted">{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
      </div>
      <p className="text-[13px] text-text-secondary leading-relaxed ml-8">{reply.content}</p>
      <div className="flex items-center gap-3 mt-1.5 ml-8">
        <span className="text-[11px] text-text-muted flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {reply.reactions.agree}</span>
        <span className="text-[11px] text-text-muted flex items-center gap-1"><Lightbulb className="w-3 h-3" /> {reply.reactions.insightful}</span>
        <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', reply.civilityScore >= 0.8 ? 'bg-positive/10 text-positive-light' : 'bg-warning/10 text-warning-light')}>
          Civility: {Math.round(reply.civilityScore * 100)}%
        </span>
      </div>
    </div>
  );
}
