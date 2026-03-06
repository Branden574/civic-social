'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/auth/auth-gate';
import {
  ArrowLeft,
  MessageSquare,
  Bookmark,
  Share2,
  BarChart3,
  ChevronDown,
  Shield,
  Award,
  BadgeCheck,
  ShieldCheck,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Scale,
  ExternalLink,
  Trash2,
  Lock,
  UserX,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { ReplySheet } from '@/components/compose/reply-sheet';
import { ThreadSkeleton } from '@/components/ui/skeleton';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { useAuth } from '@/lib/auth-context';
import type { PostData } from '@/components/feed/post-card';

// ─── Types ───────────────────────────────────────────────────

interface ServerComment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  status: string;
  replyCount: number;
  author: {
    id: string;
    displayName: string;
    affiliations: string[];
    verificationLevel: string;
  };
  _optimistic?: boolean;
}

interface LegacyReply {
  id: string;
  content: string;
  author: {
    id: string;
    displayName: string;
    affiliations: string[];
    verificationLevel: string;
  };
  createdAt: string;
  civilityScore?: number;
  reactions?: { agree: number; disagree: number; insightful: number };
}

interface PostDetail {
  id: string;
  content: string;
  createdAt: string;
  topics: string[];
  status: string;
  visibility: string;
  comment_policy: string;
  is_thread_locked: boolean;
  comment_count: number;
  viewer_can_comment: boolean;
  viewer_comment_block_reason: string | null;
  author: {
    id: string;
    displayName: string;
    affiliations: string[];
    verificationLevel: string;
    civicReputation: number;
  };
  reactions: { agree: number; disagree: number; insightful: number; nuance: number };
  sources?: { url: string; domain: string; trustScore: number }[];
  replies?: LegacyReply[];
}

type ReactionType = 'agree' | 'disagree' | 'insightful' | 'nuance';

// ─── Verification icons ──────────────────────────────────────

const verificationIcons: Record<string, { icon: typeof ShieldCheck; label: string; color: string }> = {
  EXPERT_VERIFIED: { icon: Award, label: 'Verified Expert', color: 'text-positive' },
  CITIZEN_VERIFIED: { icon: BadgeCheck, label: 'Verified Citizen', color: 'text-info' },
  EMAIL_VERIFIED: { icon: ShieldCheck, label: 'Verified', color: 'text-text-muted' },
  OFFICIAL_VERIFIED: { icon: Award, label: 'Verified Official', color: 'text-warning' },
};

// ─── Inline Toast ────────────────────────────────────────────

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

// ─── Feedback Reasons ────────────────────────────────────────

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

// ─── Feedback Modal (Portal) ─────────────────────────────────

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
          <p className="text-sm text-text-muted mb-4">Your input helps improve content ranking.</p>
          <button onClick={onSkip} className="px-6 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors">Done</button>
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
          <button onClick={onSkip} className="p-2 -mr-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-center mb-2"><div className="w-10 h-1 rounded-full bg-surface-active" /></div>
        <div className="px-5 pb-5 space-y-2">
          {reasons.map((reason) => {
            const isSelected = selected.has(reason.id);
            return (
              <button key={reason.id} onClick={() => toggle(reason.id)} className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all min-h-[48px] active:scale-[0.98]',
                isSelected ? 'bg-civic/10 border border-civic/30 text-text-primary font-medium' : 'bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-surface-hover',
              )}>
                <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0', isSelected ? 'bg-civic border-civic text-white' : 'border-border-strong')}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
                <span>{reason.label}</span>
              </button>
            );
          })}
          <div className="flex gap-2 pt-2">
            <button onClick={onSkip} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors min-h-[44px]">Skip</button>
            <button onClick={handleSubmit} disabled={selected.size === 0} className={clsx(
              'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px]',
              selected.size > 0 ? 'bg-civic text-white hover:bg-civic-dark' : 'bg-surface-active text-text-muted cursor-not-allowed',
            )}>Submit ({selected.size})</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Thread Page ─────────────────────────────────────────────

export default function ThreadPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { isAuthenticated, user: authUser } = useAuth();

  // Post state
  const [postDetail, setPostDetail] = useState<PostDetail | null>(null);
  const [fallbackPost, setFallbackPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);

  // Comments state
  const [comments, setComments] = useState<ServerComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // UI state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<ServerComment | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [showAlgo, setShowAlgo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Reaction state
  const [viewerReaction, setViewerReaction] = useState<ReactionType | null>(null);
  const [reactionDeltas, setReactionDeltas] = useState<Record<ReactionType, number>>({ agree: 0, disagree: 0, insightful: 0, nuance: 0 });
  const [reactionLoading, setReactionLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState<ReactionType | null>(null);
  const [hasFeedback, setHasFeedback] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const post = postDetail;
  const isOwnPost = Boolean(authUser && post?.author.id === authUser.id);
  const canComment = postDetail?.viewer_can_comment ?? true;
  const blockReason = postDetail?.viewer_comment_block_reason ?? null;

  // ── Fetch post detail ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const detailRes = await fetch(`/api/posts/${encodeURIComponent(postId)}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          if (!cancelled) {
            setPostDetail(data.post);
            setCommentCount(data.post.comment_count ?? 0);
          }
        } else {
          const feedRes = await fetch(`/api/feed?tab=for-you&sort=top&limit=50&_t=${Date.now()}`);
          if (feedRes.ok) {
            const feedData = await feedRes.json();
            const found = feedData.posts.find((p: PostData) => p.id === postId);
            if (found && !cancelled) {
              setFallbackPost(found);
              setCommentCount(found.comment_count ?? found.replies?.length ?? 0);
            }
          }
        }
      } catch {
        // Network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [postId]);

  // ── Fetch viewer reaction state ────────────────────────
  useEffect(() => {
    if (!postId || !isAuthenticated) return;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`);
        if (res.ok) {
          const data = await res.json();
          setViewerReaction(data.viewer_reaction);
          setReactionDeltas(data.deltas);
          setHasFeedback(data.has_feedback);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [postId, isAuthenticated]);

  // ── Fetch comments ───────────────────────────────────────
  const fetchComments = useCallback(async (cursor?: string) => {
    setCommentsLoading(true);
    try {
      const url = `/api/posts/${encodeURIComponent(postId)}/comments?limit=50${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }
        setHasMore(data.hasMore);
        setCommentCount(data.total);
      }
    } catch {
      // Network error
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!loading) fetchComments();
  }, [loading, fetchComments]);

  // ── Reaction handler ────────────────────────────────────
  const handleReaction = useCallback(async (reaction: ReactionType) => {
    if (!isAuthenticated) {
      setToast('Please log in to react to posts');
      return;
    }
    if (reactionLoading) return;

    const prevReaction = viewerReaction;
    const prevDeltas = { ...reactionDeltas };
    const newDeltas = { ...reactionDeltas };

    if (prevReaction === reaction) {
      setViewerReaction(null);
      newDeltas[reaction] = Math.max(0, newDeltas[reaction] - 1);
    } else {
      if (prevReaction) newDeltas[prevReaction] = Math.max(0, newDeltas[prevReaction] - 1);
      newDeltas[reaction] = newDeltas[reaction] + 1;
      setViewerReaction(reaction);
    }
    setReactionDeltas(newDeltas);
    setReactionLoading(true);

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) {
        const data = await res.json();
        setViewerReaction(data.viewer_reaction);
        setReactionDeltas(data.deltas);
        setHasFeedback(data.has_feedback);
        if (data.viewer_reaction && !hasFeedback && !data.has_feedback &&
            (data.viewer_reaction === 'agree' || data.viewer_reaction === 'disagree')) {
          setShowFeedback(data.viewer_reaction);
        }
      } else if (res.status === 401) {
        setToast('Please log in to react to posts');
        setViewerReaction(prevReaction);
        setReactionDeltas(prevDeltas);
      } else {
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
  }, [isAuthenticated, viewerReaction, reactionDeltas, reactionLoading, postId, hasFeedback]);

  // ── Feedback submit ─────────────────────────────────────
  const handleFeedbackSubmit = useCallback(async (reasons: string[]) => {
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', reaction: showFeedback, reasons }),
      });
      setHasFeedback(true);
    } catch {
      // Best-effort
    }
    setShowFeedback(null);
  }, [postId, showFeedback]);

  // ── Share handler ───────────────────────────────────────
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${encodeURIComponent(postId)}`;
    const displayPost = postDetail || fallbackPost;
    const title = displayPost ? `${displayPost.author.displayName} on Civic Social` : 'Civic Social';
    const text = displayPost ? displayPost.content.slice(0, 140) : '';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link copied to clipboard');
    } catch {
      setToast('Could not copy link');
    }
  }, [postId, postDetail, fallbackPost]);

  // ── Submit reply ─────────────────────────────────────────
  const handleReplySubmit = useCallback(async (content: string) => {
    setCommentError(null);
    const parentId = replyingToComment?.id || null;
    const optimisticComment: ServerComment = {
      id: `optimistic-${Date.now()}`,
      postId,
      authorId: authUser?.id || 'unknown',
      parentCommentId: parentId,
      body: content,
      createdAt: new Date().toISOString(),
      status: 'published',
      replyCount: 0,
      author: {
        id: authUser?.id || 'unknown',
        displayName: authUser?.displayName || 'You',
        affiliations: ['center'],
        verificationLevel: 'EMAIL_VERIFIED',
      },
      _optimistic: true,
    };
    setComments((prev) => [optimisticComment, ...prev]);
    setCommentCount((c) => c + 1);
    // If replying to a comment, bump its reply count optimistically
    if (parentId) {
      setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replyCount: c.replyCount + 1 } : c));
    }
    setReplyingToComment(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: content, parent_comment_id: parentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => prev.map((c) => c.id === optimisticComment.id ? { ...data.comment, _optimistic: false } : c));
        setCommentCount(data.commentCount);
      } else {
        const err = await res.json().catch(() => ({}));
        setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
        setCommentCount((c) => Math.max(0, c - 1));
        if (parentId) {
          setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c));
        }
        setCommentError(err.error || 'Failed to post comment.');
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setCommentCount((c) => Math.max(0, c - 1));
      if (parentId) {
        setComments((prev) => prev.map((c) => c.id === parentId ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c));
      }
      setCommentError('Network error. Please try again.');
    }
  }, [postId, replyingToComment, authUser]);

  // ── Delete comment ───────────────────────────────────────
  const handleDeleteComment = useCallback(async (commentId: string) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    setCommentCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments?commentId=${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        setComments(prev);
        setCommentCount((c) => c + 1);
      } else {
        const data = await res.json();
        setCommentCount(data.commentCount);
      }
    } catch {
      setComments(prev);
      setCommentCount((c) => c + 1);
    }
  }, [postId, comments]);

  // ── Delete post ──────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!post) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteConfirm(false);
        router.push('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || `Delete failed (${res.status}).`);
      }
    } catch {
      setDeleteError('Network error.');
    } finally {
      setDeleting(false);
    }
  }, [post, router]);

  const displayPost = postDetail || fallbackPost;
  const verification = displayPost ? verificationIcons[displayPost.author.verificationLevel] : null;
  const VerifIcon = verification?.icon || ShieldCheck;
  const legacyReplies: LegacyReply[] = (postDetail?.replies ?? fallbackPost?.replies ?? []) as LegacyReply[];

  // Merged counts
  const baseCounts = displayPost?.reactions ?? { agree: 0, disagree: 0, insightful: 0, nuance: 0 };
  const mergedCounts = {
    agree: baseCounts.agree + reactionDeltas.agree,
    disagree: baseCounts.disagree + reactionDeltas.disagree,
    insightful: baseCounts.insightful + reactionDeltas.insightful,
    nuance: baseCounts.nuance + reactionDeltas.nuance,
  };

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 border-r border-border-subtle">
        <div className="max-w-2xl mx-auto">
          {/* ── Sticky Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all duration-150 active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-semibold text-text-primary">Thread</h2>
              <span className="text-xs text-text-muted">
                {commentCount + legacyReplies.length} {(commentCount + legacyReplies.length) === 1 ? 'comment' : 'comments'}
              </span>
              {postDetail?.is_thread_locked && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-warning-light bg-warning/10 px-1.5 py-0.5 rounded">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
          </header>

          {loading && <ThreadSkeleton />}

          {!loading && displayPost && (
            <div className="screen-enter">
              <article className="px-4 sm:px-6 py-6 border-b border-border-subtle">
                <div className="flex items-start gap-3 mb-4">
                  <Link
                    href={`/profile/${encodeURIComponent(displayPost.author.id)}`}
                    className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary font-semibold shrink-0 border border-border-subtle hover:border-civic/50 hover:ring-2 hover:ring-civic/20 transition-all"
                  >
                    {displayPost.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/profile/${encodeURIComponent(displayPost.author.id)}`} className="text-base font-semibold text-text-primary hover:text-civic-light transition-colors">
                        {displayPost.author.displayName}
                      </Link>
                      {verification && <VerifIcon className={clsx('w-4 h-4', verification.color)} />}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <time>{new Date(displayPost.createdAt).toLocaleString()}</time>
                      {displayPost.author.affiliations[0] && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-active text-text-secondary">
                          {displayPost.author.affiliations[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[15px] text-text-primary leading-relaxed whitespace-pre-wrap mb-4">
                  {displayPost.content}
                </div>

                {displayPost.topics && displayPost.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {displayPost.topics.map((topic) => (
                      <Link key={topic} href={`/hashtag/${encodeURIComponent(topic)}`} className="text-xs font-medium text-civic-light bg-civic/8 px-2 py-0.5 rounded-full hover:bg-civic/15 transition-colors">
                        #{topic}
                      </Link>
                    ))}
                  </div>
                )}

                {displayPost.sources && displayPost.sources.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    {displayPost.sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-civic-light hover:text-civic bg-surface rounded-lg px-3 py-2 border border-border-subtle hover:border-civic/30 transition-all">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{src.domain}</span>
                        <span className={clsx('ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded', src.trustScore >= 0.8 ? 'bg-positive/10 text-positive-light' : 'bg-warning/10 text-warning-light')}>
                          {Math.round(src.trustScore * 100)}%
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {/* ── Reaction Counts Row ── */}
                <div className="flex items-center gap-4 py-3 border-y border-border-subtle text-xs text-text-muted flex-wrap">
                  <span><strong className="text-text-primary">{mergedCounts.agree}</strong> Agree</span>
                  <span><strong className="text-text-primary">{mergedCounts.disagree}</strong> Disagree</span>
                  <span><strong className="text-text-primary">{mergedCounts.insightful}</strong> Insightful</span>
                  <span><strong className="text-text-primary">{mergedCounts.nuance}</strong> Nuanced</span>
                </div>

                {/* ── Action Buttons (API-connected) ── */}
                <div className="flex items-center justify-around py-2 -mx-2 flex-wrap gap-1">
                  {([
                    { type: 'agree' as ReactionType, icon: ThumbsUp, label: 'Agree', color: 'text-positive-light', bg: 'bg-positive/10' },
                    { type: 'disagree' as ReactionType, icon: ThumbsDown, label: 'Disagree', color: 'text-danger-light', bg: 'bg-danger/10' },
                    { type: 'insightful' as ReactionType, icon: Lightbulb, label: 'Insightful', color: 'text-warning-light', bg: 'bg-warning/10' },
                    { type: 'nuance' as ReactionType, icon: Scale, label: 'Nuanced', color: 'text-civic-light', bg: 'bg-civic/10' },
                  ]).map((btn) => {
                    const isActive = viewerReaction === btn.type;
                    return (
                      <button
                        key={btn.type}
                        onClick={() => handleReaction(btn.type)}
                        disabled={reactionLoading}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-90 min-h-[44px] select-none',
                          isActive ? `${btn.color} ${btn.bg} font-semibold` : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                          reactionLoading && 'opacity-60',
                        )}
                      >
                        <btn.icon className={clsx('w-4 h-4', isActive && btn.color)} />
                        <span className="hidden sm:inline">{btn.label}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setBookmarked(!bookmarked)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-90 min-h-[44px]',
                      bookmarked ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    <span className="hidden sm:inline">Save</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-all duration-150 active:scale-90 min-h-[44px]"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  {isOwnPost && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium text-text-muted hover:text-danger-light hover:bg-danger/5 transition-all duration-150 active:scale-90 min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}
                </div>

                {'algorithm' in displayPost && (displayPost as PostData).algorithm && (
                  <>
                    <button
                      onClick={() => setShowAlgo(!showAlgo)}
                      className="flex items-center gap-2 mt-2 text-xs text-text-muted hover:text-text-secondary transition-colors min-h-[44px]"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Why am I seeing this?
                      <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', showAlgo && 'rotate-180')} />
                    </button>
                    {showAlgo && (
                      <div className="mt-2 p-3 bg-surface rounded-lg border border-border-subtle animate-slide-up text-xs text-text-secondary">
                        <p>{(displayPost as PostData).algorithm.explanation}</p>
                      </div>
                    )}
                  </>
                )}
              </article>

              {/* ── Reply input / disabled state ── */}
              <div className="px-4 sm:px-6 py-3 border-b border-border-subtle">
                {canComment ? (
                  <button
                    onClick={() => setReplyOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-surface-elevated rounded-xl border border-border-subtle text-sm text-text-muted hover:text-text-secondary hover:border-border-strong transition-all duration-150 active:scale-[0.99] min-h-[44px]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Post your reply...
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-surface/50 rounded-xl border border-border-subtle text-sm text-text-muted min-h-[44px]">
                    {blockReason?.includes('locked') ? <Lock className="w-4 h-4 text-warning-light shrink-0" />
                      : blockReason?.includes('Blocked') ? <UserX className="w-4 h-4 text-danger-light shrink-0" />
                        : <MessageSquare className="w-4 h-4 shrink-0" />}
                    <span>{blockReason || 'Comments are not available'}</span>
                  </div>
                )}
              </div>

              {commentError && (
                <div className="mx-4 sm:mx-6 mt-2 flex items-center gap-2 p-2.5 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger-light">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {commentError}
                  <button onClick={() => setCommentError(null)} className="ml-auto text-text-muted hover:text-text-secondary p-1 min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
                </div>
              )}

              <div>
                {comments.map((comment, i) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    index={i}
                    isOwn={Boolean(authUser && comment.authorId === authUser.id)}
                    onDelete={() => handleDeleteComment(comment.id)}
                    onReply={(c) => { setReplyingToComment(c); setReplyOpen(true); }}
                    postId={postId}
                  />
                ))}
                {legacyReplies.map((reply, i) => {
                  const replyVerif = verificationIcons[reply.author.verificationLevel];
                  const ReplyVerifIcon = replyVerif?.icon || ShieldCheck;
                  return (
                    <div key={reply.id} className="px-4 sm:px-6 py-4 border-b border-border-subtle hover:bg-surface/30 transition-colors duration-150 animate-fade-in" style={{ animationDelay: `${(comments.length + i) * 50}ms`, animationFillMode: 'forwards', opacity: 0 }}>
                      <div className="flex items-start gap-3">
                        <Link href={`/profile/${encodeURIComponent(reply.author.id)}`} className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-xs font-semibold border border-border-subtle hover:border-civic/50 transition-all shrink-0">
                          {reply.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </Link>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm font-semibold text-text-primary">{reply.author.displayName}</span>
                            {replyVerif && <ReplyVerifIcon className={clsx('w-3.5 h-3.5', replyVerif.color)} />}
                            <span className="text-[11px] text-text-muted">· {formatRelativeTime(reply.createdAt)}</span>
                          </div>
                          <p className="text-[14px] text-text-secondary leading-relaxed">{reply.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 0 && legacyReplies.length === 0 && !commentsLoading && (
                  <div className="px-4 sm:px-6 py-12 text-center">
                    <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No comments yet. Be the first to contribute.</p>
                  </div>
                )}
                {commentsLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 text-civic animate-spin" />
                  </div>
                )}
                {hasMore && !commentsLoading && (
                  <div className="flex justify-center py-4">
                    <button
                      onClick={() => {
                        const last = comments[comments.length - 1];
                        if (last) fetchComments(last.id);
                      }}
                      className="text-xs text-civic-light hover:text-civic font-medium px-4 py-2.5 rounded-lg hover:bg-civic/10 transition-all min-h-[44px]"
                    >
                      Load more comments
                    </button>
                  </div>
                )}
              </div>

              <div ref={commentsEndRef} className="h-24 lg:h-8" />
            </div>
          )}

          {!loading && !displayPost && (
            <div className="px-4 sm:px-6 py-16 text-center">
              <Shield className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary mb-1">Post not found</h3>
              <p className="text-xs text-text-muted">This post may have been removed.</p>
              <Link href="/" className="inline-block mt-4 text-sm text-civic-light hover:underline">Return to feed</Link>
            </div>
          )}
        </div>
      </main>
      <MobileNav />

      <ReplySheet
        isOpen={replyOpen}
        onClose={() => { setReplyOpen(false); setReplyingToComment(null); }}
        onSubmit={handleReplySubmit}
        replyingTo={
          replyingToComment
            ? { displayName: replyingToComment.author.displayName, content: replyingToComment.body.slice(0, 120) }
            : displayPost
              ? { displayName: displayPost.author.displayName, content: displayPost.content.slice(0, 120) }
              : undefined
        }
      />

      {displayPost && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => { if (!deleting) { setShowDeleteConfirm(false); setDeleteError(null); } }}
          onConfirm={handleDelete}
          deleting={deleting}
          contentPreview={displayPost.content}
          error={deleteError}
        />
      )}

      {/* Feedback modal (portal) */}
      {showFeedback && (
        <FeedbackModal
          reactionType={showFeedback}
          onSubmit={handleFeedbackSubmit}
          onSkip={() => setShowFeedback(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
    </AuthGate>
  );
}

// ─── Comment Card ────────────────────────────────────────────

function CommentCard({
  comment,
  index,
  isOwn,
  onDelete,
  onReply,
  postId,
}: {
  comment: ServerComment;
  index: number;
  isOwn: boolean;
  onDelete: () => void;
  onReply: (parentComment: ServerComment) => void;
  postId: string;
}) {
  const verif = verificationIcons[comment.author.verificationLevel];
  const VerifIcon = verif?.icon || ShieldCheck;

  // Comment-level reactions (use postId/reactions API with comment ID as entity)
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);

  const handleLike = useCallback(async () => {
    const wasLiked = liked;
    const wasDisliked = disliked;
    setLiked(!wasLiked);
    setDisliked(false);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    if (wasDisliked) setDislikeCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id, reaction: wasLiked ? null : 'like' }),
      });
    } catch {
      setLiked(wasLiked);
      setDisliked(wasDisliked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      if (wasDisliked) setDislikeCount((c) => c + 1);
    }
  }, [liked, disliked, comment.id, postId]);

  const handleDislike = useCallback(async () => {
    const wasLiked = liked;
    const wasDisliked = disliked;
    setDisliked(!wasDisliked);
    setLiked(false);
    setDislikeCount((c) => c + (wasDisliked ? -1 : 1));
    if (wasLiked) setLikeCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id, reaction: wasDisliked ? null : 'dislike' }),
      });
    } catch {
      setLiked(wasLiked);
      setDisliked(wasDisliked);
      setDislikeCount((c) => c + (wasDisliked ? 1 : -1));
      if (wasLiked) setLikeCount((c) => c + 1);
    }
  }, [liked, disliked, comment.id, postId]);

  return (
    <div
      className={clsx(
        'px-4 sm:px-6 py-4 border-b border-border-subtle hover:bg-surface/30 transition-colors duration-150 animate-fade-in',
        comment._optimistic && 'opacity-70',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards', opacity: 0 }}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/profile/${encodeURIComponent(comment.author.id)}`}
          className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-xs font-semibold border border-border-subtle hover:border-civic/50 transition-all shrink-0"
        >
          {comment.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </Link>
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Link href={`/profile/${encodeURIComponent(comment.author.id)}`} className="text-sm font-semibold text-text-primary hover:text-civic-light transition-colors">
              {comment.author.displayName}
            </Link>
            {verif && <VerifIcon className={clsx('w-3.5 h-3.5', verif.color)} />}
            <span className="text-[11px] text-text-muted">· {formatRelativeTime(comment.createdAt)}</span>
            {comment._optimistic && <Loader2 className="w-3 h-3 text-text-muted animate-spin" />}
          </div>
          <p className="text-[14px] text-text-secondary leading-relaxed">{comment.body}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleLike}
              className={clsx(
                'flex items-center gap-1 text-xs transition-colors active:scale-90 p-1 min-w-[44px] min-h-[44px] justify-center',
                liked ? 'text-positive-light' : 'text-text-muted hover:text-positive-light',
              )}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <button
              onClick={handleDislike}
              className={clsx(
                'flex items-center gap-1 text-xs transition-colors active:scale-90 p-1 min-w-[44px] min-h-[44px] justify-center',
                disliked ? 'text-danger-light' : 'text-text-muted hover:text-danger-light',
              )}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {dislikeCount > 0 && <span>{dislikeCount}</span>}
            </button>
            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-civic-light transition-colors active:scale-90 p-1 min-w-[44px] min-h-[44px] justify-center"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {comment.replyCount > 0 && comment.replyCount}
            </button>
            {isOwn && (
              <button onClick={onDelete} className="flex items-center gap-1 text-xs text-text-muted hover:text-danger-light transition-colors ml-auto p-1 min-w-[44px] min-h-[44px] justify-center">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}
