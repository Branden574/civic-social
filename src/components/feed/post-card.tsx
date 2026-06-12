'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { TransitionLink, useViewTransitionRouter } from '@/lib/view-transitions';
import {
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Layers,
  Bookmark,
  Share2,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  MessageCircle,
  Flag,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ContextPanel } from './context-panel';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { useAuth } from '@/lib/auth-context';
import { MentionText } from '@/components/ui/mention-text';
import { CredibilityBar } from './post-card/credibility-bar';
import { AlgorithmExplainer } from './post-card/algorithm-explainer';
import { InlineReportPanel } from './post-card/inline-report-panel';
import { ReplyCard } from './post-card/reply-card';
import { FeedbackModal } from './post-card/feedback-modal';
import { verificationIcons, ideologyTextColor, threadTypeLabels } from './post-card/constants';
import type { PostData, ReactionType } from './post-card/types';

// Re-export the public type so existing imports keep working unchanged.
export type {
  PostData,
  PostAuthor,
  PostSource,
  PostReactions,
  PostThread,
  PostAlgorithm,
  PostReply,
  ReactionType,
} from './post-card/types';

// ─── Helpers ─────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toString();
}

/**
 * Derive the 0–100 credibility score shown in the inline bar from the post
 * algorithm signals. Weighting mirrors the prior CredibilityMeter so the
 * surfaced number stays consistent across the app.
 */
function computeCredibilityScore(post: PostData): number {
  const s = post.algorithm.signals;
  const raw =
    0.35 * s.sourceCredibility +
    0.25 * s.authorReputation +
    0.2 * s.civility +
    0.2 * (1 - s.penalty);
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

// ─── Toast Component ─────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return createPortal(
    <div
      role="status"
      className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg text-sm text-text-primary animate-slide-up"
    >
      {message}
    </div>,
    document.body,
  );
}

// ─── Reaction button definitions (colors per prototype RX_DEFS) ──────────
const REACTION_DEFS: {
  type: ReactionType;
  icon: typeof ThumbsUp;
  label: string;
  color: string;
  bgActive: string;
}[] = [
  { type: 'agree', icon: ThumbsUp, label: 'Agree', color: 'text-positive-light', bgActive: 'bg-positive/[0.12]' },
  { type: 'disagree', icon: ThumbsDown, label: 'Disagree', color: 'text-danger-light', bgActive: 'bg-danger/10' },
  { type: 'insightful', icon: Lightbulb, label: 'Insightful', color: 'text-warning-light', bgActive: 'bg-warning/[0.12]' },
  { type: 'nuance', icon: Layers, label: 'Nuance', color: 'text-ideology-center-left', bgActive: 'bg-ideology-center-left/[0.12]' },
];

// ─── Post Card Component ─────────────────────────────────────

export const PostCard = memo(function PostCard({
  post,
  index,
  onDelete,
}: {
  post: PostData;
  index: number;
  onDelete?: (postId: string) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const vtRouter = useViewTransitionRouter();
  const [expanded, setExpanded] = useState(false);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [showTrust, setShowTrust] = useState(false);
  const [showReplies] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Reaction state (server-authoritative)
  const [viewerReaction, setViewerReaction] = useState<ReactionType | null>(null);
  const [reactionDeltas, setReactionDeltas] = useState<Record<ReactionType, number>>({
    agree: 0,
    disagree: 0,
    insightful: 0,
    nuance: 0,
  });
  const [reactionLoading, setReactionLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState<ReactionType | null>(null);

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
  const handleReaction = useCallback(
    async (e: React.MouseEvent, reaction: ReactionType) => {
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

          // Show feedback panel for agree/disagree on first reaction
          if (
            data.viewer_reaction &&
            !data.has_feedback &&
            (data.viewer_reaction === 'agree' || data.viewer_reaction === 'disagree')
          ) {
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
    },
    [isAuthenticated, viewerReaction, reactionDeltas, reactionLoading, post.id],
  );

  // ── Share handler ──────────────────────────────────────────
  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
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
    },
    [post.id, post.author.displayName, post.content],
  );

  // ── Feedback submit handler ────────────────────────────────
  const handleFeedbackSubmit = useCallback(
    async (reasons: string[]) => {
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
      } catch {
        // Feedback submission is best-effort
      }
      setShowFeedback(null);
    },
    [post.id, showFeedback],
  );

  const verification = verificationIcons[post.author.verificationLevel];
  const threadType = post.thread ? threadTypeLabels[post.thread.type] : null;
  const postTypeLabel =
    !threadType && post.postType && post.postType !== 'OPEN_DISCUSSION'
      ? threadTypeLabels[post.postType] || null
      : null;
  const displayType = threadType || postTypeLabel;
  const ideology = post.author.affiliations[0];
  const ideologyClass = ideology ? ideologyTextColor[ideology] ?? 'text-text-muted' : '';
  const credibilityScore = computeCredibilityScore(post);
  const hasMeta = post.sources.length > 0 || post.thread !== null;

  const isLong = post.content.length > 300;
  const displayContent = isLong && !expanded ? post.content.slice(0, 300) + '...' : post.content;

  // Merged counts = base (from server data) + deltas (from real reactions)
  const counts: Record<ReactionType, number> = {
    agree: post.reactions.agree + reactionDeltas.agree,
    disagree: post.reactions.disagree + reactionDeltas.disagree,
    insightful: post.reactions.insightful + reactionDeltas.insightful,
    nuance: post.reactions.nuance + reactionDeltas.nuance,
  };

  const commentsDisabled = post.comment_policy === 'off' || post.is_thread_locked;

  return (
    <article
      className={clsx(
        'feed-item animate-fade-in opacity-0 border-b border-border-hairline px-4 sm:px-[18px] pt-3.5 pb-2 transition-[background-color,opacity] duration-150 hover:bg-surface',
        post._optimistic && 'opacity-[0.55]',
        post._failed && 'opacity-[0.55] border-l-2 border-l-danger',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
    >
      {post._optimistic && (
        <div className="flex items-center gap-[7px] text-[11.5px] text-civic-light mb-2 pl-[56px]">
          <span
            className="w-[11px] h-[11px] border-2 border-civic-muted border-t-civic rounded-full animate-spin"
            aria-hidden="true"
          />
          Posting…
        </div>
      )}
      {post._failed && (
        <div className="flex items-center gap-1.5 text-[11.5px] mb-2 pl-[56px]">
          <span className="font-semibold text-danger-light">Failed to post</span>
          <span className="text-text-muted">— tap to retry or dismiss</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* ── Avatar ── */}
        <TransitionLink
          href={`/profile/${encodeURIComponent(post.author.id)}`}
          transitionType="avatar-morph"
          viewTransitionName={`avatar-${post.author.id}`}
          className="w-11 h-11 rounded-full shrink-0 cursor-pointer overflow-hidden"
          aria-label={`${post.author.displayName} profile`}
        >
          {post.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.avatarUrl}
              alt={post.author.displayName}
              className="w-11 h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-surface-hover flex items-center justify-center text-text-secondary text-sm font-bold">
              {post.author.displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
          )}
        </TransitionLink>

        <div className="flex-1 min-w-0">
          {/* ── Author row ── */}
          <div className="flex items-center gap-[7px] flex-wrap">
            <TransitionLink
              href={`/profile/${encodeURIComponent(post.author.id)}`}
              transitionType="avatar-morph"
              viewTransitionName={`author-name-${post.author.id}`}
              className="text-[15px] font-bold text-text-primary hover:underline transition-colors break-words [overflow-wrap:anywhere] min-w-0"
            >
              {post.author.displayName}
            </TransitionLink>
            {verification && (
              <span title={verification.label} className="inline-flex">
                {verification.icon === BadgeCheck ? (
                  <BadgeCheck className="w-[15px] h-[15px] text-civic" aria-hidden="true" />
                ) : (
                  <verification.icon className={clsx('w-[15px] h-[15px]', verification.color)} aria-hidden="true" />
                )}
              </span>
            )}
            {ideology && (
              <span
                className={clsx(
                  'text-[10.5px] font-semibold px-2 py-0.5 rounded-full border border-border-subtle',
                  ideologyClass,
                )}
              >
                {ideology}
              </span>
            )}
            <span className="text-[12.5px] text-text-muted">
              · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>

            <span className="ml-auto flex items-center gap-0.5">
              {displayType && (
                <span
                  className={clsx(
                    'text-[10.5px] font-semibold px-[9px] py-[3px] rounded-full whitespace-nowrap',
                    displayType.bg,
                    displayType.text,
                  )}
                >
                  {displayType.label}
                </span>
              )}

              {isOwnPost ? (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreMenu(!showMoreMenu);
                    }}
                    aria-label="More options"
                    aria-haspopup="menu"
                    aria-expanded={showMoreMenu}
                    className="flex items-center justify-center w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    <MoreHorizontal className="w-[15px] h-[15px]" aria-hidden="true" />
                  </button>

                  {showMoreMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated rounded-xl border border-border-subtle shadow-lg z-50 animate-fade-in overflow-hidden"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMoreMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-danger-light hover:bg-danger/[0.07] transition-colors text-left min-h-[44px]"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Delete post
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAlgorithm(!showAlgorithm);
                  }}
                  aria-label="Why am I seeing this?"
                  aria-expanded={showAlgorithm}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <MoreHorizontal className="w-[15px] h-[15px]" aria-hidden="true" />
                </button>
              )}
            </span>
          </div>

          {/* ── Body (clickable → thread view) ── */}
          <div
            role="link"
            tabIndex={0}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) return;
              vtRouter.push(`/post/${encodeURIComponent(post.id)}`, { transitionType: 'post-expand' });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !(e.target as HTMLElement).closest('a')) {
                vtRouter.push(`/post/${encodeURIComponent(post.id)}`, { transitionType: 'post-expand' });
              }
            }}
            className="block mt-[5px] text-[15px] leading-[1.6] text-text-primary whitespace-pre-line [text-wrap:pretty] break-words [overflow-wrap:anywhere] cursor-pointer"
          >
            <MentionText text={displayContent} />
          </div>
          {isLong && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-civic-light text-[13px] font-medium mt-1 hover:underline flex items-center gap-1 min-h-[44px]"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          )}

          {post.topics.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mt-2">
              {post.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/hashtag/${encodeURIComponent(topic)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] font-medium text-civic-light hover:underline transition-colors cursor-pointer break-all"
                >
                  #{topic}
                </Link>
              ))}
            </div>
          )}

          {/* ── Credibility meter (thin bar + expandable sources) ── */}
          {hasMeta && (
            <CredibilityBar
              score={credibilityScore}
              sources={post.sources}
              thread={post.thread}
              open={showTrust}
              onToggle={() => setShowTrust((v) => !v)}
            />
          )}

          <ContextPanel topics={post.topics} />

          {/* ── "Why am I seeing this?" expansion ── */}
          {showAlgorithm && <AlgorithmExplainer algorithm={post.algorithm} postContent={post.content} />}

          {/* ── Reactions row ── */}
          <div className="flex items-center gap-0.5 flex-wrap mt-[5px] -ml-2">
            {REACTION_DEFS.map((btn) => {
              const isActive = viewerReaction === btn.type;
              return (
                <button
                  key={btn.type}
                  type="button"
                  onClick={(e) => handleReaction(e, btn.type)}
                  disabled={reactionLoading}
                  aria-pressed={isActive}
                  aria-label={`${btn.label} (${counts[btn.type]})`}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-[7px] rounded-[10px] text-[12.5px] font-semibold transition-colors duration-150 min-h-[44px] select-none',
                    isActive ? `${btn.color} ${btn.bgActive}` : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
                    reactionLoading && 'opacity-60',
                  )}
                  title={btn.label}
                >
                  <btn.icon className="w-4 h-4" aria-hidden="true" />
                  <span>{formatNumber(counts[btn.type])}</span>
                </button>
              );
            })}

            <TransitionLink
              href={`/post/${post.id}`}
              transitionType="post-expand"
              onClick={(e) => {
                if (commentsDisabled) e.preventDefault();
                e.stopPropagation();
              }}
              aria-disabled={commentsDisabled}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-[7px] rounded-[10px] text-[12.5px] font-semibold transition-colors min-h-[44px]',
                commentsDisabled
                  ? 'text-text-muted/50 cursor-default'
                  : 'text-text-muted hover:text-civic-light hover:bg-surface-hover',
              )}
              title={
                post.is_thread_locked
                  ? 'Thread locked'
                  : post.comment_policy === 'off'
                    ? 'Comments turned off'
                    : 'Reply'
              }
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              {(() => {
                const count = post.comment_count ?? post.replies?.length ?? 0;
                return count > 0 ? formatNumber(count) : 'Reply';
              })()}
            </TransitionLink>

            <span className="flex-1" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBookmarked(!bookmarked);
              }}
              aria-label={bookmarked ? 'Remove bookmark' : 'Save post'}
              aria-pressed={bookmarked}
              title={bookmarked ? 'Remove bookmark' : 'Save'}
              className={clsx(
                'flex items-center justify-center w-11 h-11 rounded-[10px] transition-colors',
                bookmarked ? 'text-civic-light' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <Bookmark className="w-4 h-4" fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReport(!showReport);
              }}
              aria-label="Report content"
              aria-expanded={showReport}
              title="Report content"
              className={clsx(
                'flex items-center justify-center w-11 h-11 rounded-[10px] transition-colors',
                showReport ? 'text-danger-light bg-danger/10' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share"
              title="Share"
              className="flex items-center justify-center w-11 h-11 rounded-[10px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
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

          {showReplies && post.replies.length > 0 && (
            <div className="mt-4 space-y-3 border-l-2 border-border-subtle pl-4 animate-fade-in">
              {post.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!deleting) {
            setShowDeleteConfirm(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDelete}
        deleting={deleting}
        contentPreview={post.content}
        error={deleteError}
      />
    </article>
  );
});
