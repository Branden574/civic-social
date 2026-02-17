'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Heart,
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
} from 'lucide-react';
import clsx from 'clsx';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { ReplySheet } from '@/components/compose/reply-sheet';
import { ThreadSkeleton } from '@/components/ui/skeleton';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
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

// ─── Verification icons ──────────────────────────────────────

const verificationIcons: Record<string, { icon: typeof ShieldCheck; label: string; color: string }> = {
  EXPERT_VERIFIED: { icon: Award, label: 'Verified Expert', color: 'text-positive' },
  CITIZEN_VERIFIED: { icon: BadgeCheck, label: 'Verified Citizen', color: 'text-info' },
  EMAIL_VERIFIED: { icon: ShieldCheck, label: 'Verified', color: 'text-text-muted' },
  OFFICIAL_VERIFIED: { icon: Award, label: 'Verified Official', color: 'text-warning' },
};

// ─── Thread Page ─────────────────────────────────────────────

export default function ThreadPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();

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
  const [bookmarked, setBookmarked] = useState(false);
  const [showAlgo, setShowAlgo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const post = postDetail;
  const isOwnPost = post?.author.id === 'user-current';
  const canComment = postDetail?.viewer_can_comment ?? true;
  const blockReason = postDetail?.viewer_comment_block_reason ?? null;

  // ── Fetch post detail ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Try the detail API first
        const detailRes = await fetch(`/api/posts/${encodeURIComponent(postId)}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          if (!cancelled) {
            setPostDetail(data.post);
            setCommentCount(data.post.comment_count ?? 0);
          }
        } else {
          // Fall back to feed search for mock posts
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

  // ── Submit reply ─────────────────────────────────────────
  const handleReplySubmit = useCallback(async (content: string) => {
    setCommentError(null);

    // Optimistic insert
    const optimisticComment: ServerComment = {
      id: `optimistic-${Date.now()}`,
      postId,
      authorId: 'user-current',
      parentCommentId: null,
      body: content,
      createdAt: new Date().toISOString(),
      status: 'published',
      replyCount: 0,
      author: {
        id: 'user-current',
        displayName: 'You',
        affiliations: ['center-left'],
        verificationLevel: 'EMAIL_VERIFIED',
      },
      _optimistic: true,
    };

    setComments((prev) => [optimisticComment, ...prev]);
    setCommentCount((c) => c + 1);

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: content }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace optimistic with server response
        setComments((prev) =>
          prev.map((c) => c.id === optimisticComment.id ? { ...data.comment, _optimistic: false } : c),
        );
        setCommentCount(data.commentCount);
      } else {
        const err = await res.json().catch(() => ({}));
        // Rollback
        setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
        setCommentCount((c) => Math.max(0, c - 1));
        setCommentError(err.error || 'Failed to post comment.');
      }
    } catch {
      // Rollback
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      setCommentCount((c) => Math.max(0, c - 1));
      setCommentError('Network error. Please try again.');
    }
  }, [postId]);

  // ── Delete comment ───────────────────────────────────────
  const handleDeleteComment = useCallback(async (commentId: string) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    setCommentCount((c) => Math.max(0, c - 1));

    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/comments?commentId=${commentId}`, {
        method: 'DELETE',
      });
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

  // Resolve display data (prefer detail API, fall back to feed data)
  const displayPost = postDetail || fallbackPost;
  const verification = displayPost ? verificationIcons[displayPost.author.verificationLevel] : null;
  const VerifIcon = verification?.icon || ShieldCheck;

  // Legacy mock replies from the post detail API or fallback feed data
  const legacyReplies: LegacyReply[] = (postDetail?.replies ?? fallbackPost?.replies ?? []) as LegacyReply[];

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 border-r border-border-subtle">
        <div className="max-w-2xl mx-auto">
          {/* ── Sticky Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all duration-150 active:scale-90"
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

          {/* ── Loading State ── */}
          {loading && <ThreadSkeleton />}

          {/* ── Thread Content ── */}
          {!loading && displayPost && (
            <div className="screen-enter">
              {/* ── Main Post (expanded) ── */}
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
                      <Link
                        href={`/profile/${encodeURIComponent(displayPost.author.id)}`}
                        className="text-base font-semibold text-text-primary hover:text-civic-light transition-colors"
                      >
                        {displayPost.author.displayName}
                      </Link>
                      {verification && (
                        <VerifIcon className={clsx('w-4 h-4', verification.color)} />
                      )}
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
                      <Link
                        key={topic}
                        href={`/hashtag/${encodeURIComponent(topic)}`}
                        className="text-xs font-medium text-civic-light bg-civic/8 px-2 py-0.5 rounded-full hover:bg-civic/15 transition-colors"
                      >
                        #{topic}
                      </Link>
                    ))}
                  </div>
                )}

                {displayPost.sources && displayPost.sources.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    {displayPost.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-civic-light hover:text-civic bg-surface rounded-lg px-3 py-2 border border-border-subtle hover:border-civic/30 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{src.domain}</span>
                        <span className={clsx(
                          'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded',
                          src.trustScore >= 0.8 ? 'bg-positive/10 text-positive-light' : 'bg-warning/10 text-warning-light',
                        )}>
                          {Math.round(src.trustScore * 100)}%
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 py-3 border-y border-border-subtle text-xs text-text-muted">
                  <span><strong className="text-text-primary">{displayPost.reactions.agree}</strong> Agree</span>
                  <span><strong className="text-text-primary">{displayPost.reactions.disagree}</strong> Disagree</span>
                  <span><strong className="text-text-primary">{displayPost.reactions.insightful}</strong> Insightful</span>
                  <span><strong className="text-text-primary">{displayPost.reactions.nuance}</strong> Nuanced</span>
                </div>

                <div className="flex items-center justify-around py-2 -mx-2">
                  <ActionButton icon={ThumbsUp} label="Agree" onClick={() => {}} />
                  <ActionButton icon={ThumbsDown} label="Disagree" onClick={() => {}} />
                  <ActionButton icon={Lightbulb} label="Insightful" onClick={() => {}} />
                  <ActionButton icon={Scale} label="Nuanced" onClick={() => {}} />
                  <ActionButton
                    icon={bookmarked ? BookmarkCheck : Bookmark}
                    label="Save"
                    active={bookmarked}
                    onClick={() => setBookmarked(!bookmarked)}
                  />
                  <ActionButton icon={Share2} label="Share" onClick={() => {}} />
                  {isOwnPost && (
                    <ActionButton icon={Trash2} label="Delete" onClick={() => setShowDeleteConfirm(true)} />
                  )}
                </div>

                {/* Algorithm explanation */}
                {'algorithm' in displayPost && (displayPost as PostData).algorithm && (
                  <>
                    <button
                      onClick={() => setShowAlgo(!showAlgo)}
                      className="flex items-center gap-2 mt-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 bg-surface-elevated rounded-xl border border-border-subtle text-sm text-text-muted hover:text-text-secondary hover:border-border-strong transition-all duration-150 active:scale-[0.99]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Post your reply...
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-surface/50 rounded-xl border border-border-subtle text-sm text-text-muted">
                    {blockReason?.includes('locked') ? (
                      <Lock className="w-4 h-4 text-warning-light shrink-0" />
                    ) : blockReason?.includes('Blocked') ? (
                      <UserX className="w-4 h-4 text-danger-light shrink-0" />
                    ) : (
                      <MessageSquare className="w-4 h-4 shrink-0" />
                    )}
                    <span>{blockReason || 'Comments are not available'}</span>
                  </div>
                )}
              </div>

              {/* ── Comment error ── */}
              {commentError && (
                <div className="mx-4 sm:mx-6 mt-2 flex items-center gap-2 p-2.5 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger-light">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {commentError}
                  <button onClick={() => setCommentError(null)} className="ml-auto text-text-muted hover:text-text-secondary">×</button>
                </div>
              )}

              {/* ── Comments list ── */}
              <div>
                {/* Server-persisted comments */}
                {comments.map((comment, i) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    index={i}
                    isOwn={comment.authorId === 'user-current'}
                    onDelete={() => handleDeleteComment(comment.id)}
                  />
                ))}

                {/* Legacy mock replies (from feed data) */}
                {legacyReplies.map((reply, i) => {
                  const replyVerif = verificationIcons[reply.author.verificationLevel];
                  const ReplyVerifIcon = replyVerif?.icon || ShieldCheck;
                  return (
                    <div
                      key={reply.id}
                      className="px-4 sm:px-6 py-4 border-b border-border-subtle hover:bg-surface/30 transition-colors duration-150 animate-fade-in"
                      style={{ animationDelay: `${(comments.length + i) * 50}ms`, animationFillMode: 'forwards', opacity: 0 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <Link
                            href={`/profile/${encodeURIComponent(reply.author.id)}`}
                            className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-xs font-semibold border border-border-subtle hover:border-civic/50 transition-all shrink-0"
                          >
                            {reply.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </Link>
                        </div>
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

                {/* Empty state — only show if there are truly no comments or replies */}
                {comments.length === 0 && legacyReplies.length === 0 && !commentsLoading && (
                  <div className="px-4 sm:px-6 py-12 text-center">
                    <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No comments yet. Be the first to contribute.</p>
                  </div>
                )}

                {/* Loading more */}
                {commentsLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 text-civic animate-spin" />
                  </div>
                )}

                {/* Load more */}
                {hasMore && !commentsLoading && (
                  <div className="flex justify-center py-4">
                    <button
                      onClick={() => {
                        const last = comments[comments.length - 1];
                        if (last) fetchComments(last.id);
                      }}
                      className="text-xs text-civic-light hover:text-civic font-medium px-4 py-2 rounded-lg hover:bg-civic/10 transition-all"
                    >
                      Load more comments
                    </button>
                  </div>
                )}
              </div>

              <div ref={commentsEndRef} className="h-24 lg:h-8" />
            </div>
          )}

          {/* ── Not Found ── */}
          {!loading && !displayPost && (
            <div className="px-4 sm:px-6 py-16 text-center">
              <Shield className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-text-primary mb-1">Post not found</h3>
              <p className="text-xs text-text-muted">This post may have been removed or does not exist.</p>
              <Link href="/" className="inline-block mt-4 text-sm text-civic-light hover:underline">
                Return to feed
              </Link>
            </div>
          )}
        </div>
      </main>
      <MobileNav />

      {/* Reply Sheet */}
      <ReplySheet
        isOpen={replyOpen}
        onClose={() => setReplyOpen(false)}
        onSubmit={handleReplySubmit}
        replyingTo={displayPost ? { displayName: displayPost.author.displayName, content: displayPost.content.slice(0, 120) } : undefined}
      />

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}

// ─── Comment Card ────────────────────────────────────────────

function CommentCard({
  comment,
  index,
  isOwn,
  onDelete,
}: {
  comment: ServerComment;
  index: number;
  isOwn: boolean;
  onDelete: () => void;
}) {
  const verif = verificationIcons[comment.author.verificationLevel];
  const VerifIcon = verif?.icon || ShieldCheck;

  return (
    <div
      className={clsx(
        'px-4 sm:px-6 py-4 border-b border-border-subtle hover:bg-surface/30 transition-colors duration-150 animate-fade-in',
        comment._optimistic && 'opacity-70',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards', opacity: 0 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <Link
            href={`/profile/${encodeURIComponent(comment.author.id)}`}
            className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-xs font-semibold border border-border-subtle hover:border-civic/50 transition-all shrink-0"
          >
            {comment.author.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </Link>
        </div>

        <div className="flex-1 min-w-0 pb-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Link
              href={`/profile/${encodeURIComponent(comment.author.id)}`}
              className="text-sm font-semibold text-text-primary hover:text-civic-light transition-colors"
            >
              {comment.author.displayName}
            </Link>
            {verif && <VerifIcon className={clsx('w-3.5 h-3.5', verif.color)} />}
            <span className="text-[11px] text-text-muted">· {formatRelativeTime(comment.createdAt)}</span>
            {comment._optimistic && (
              <Loader2 className="w-3 h-3 text-text-muted animate-spin" />
            )}
          </div>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            {comment.body}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button className="flex items-center gap-1 text-xs text-text-muted hover:text-positive-light transition-colors active:scale-90">
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 text-xs text-text-muted hover:text-danger-light transition-colors active:scale-90">
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 text-xs text-text-muted hover:text-civic-light transition-colors active:scale-90">
              <MessageSquare className="w-3.5 h-3.5" />
              {comment.replyCount > 0 && comment.replyCount}
            </button>
            {isOwn && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-danger-light transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  const [animating, setAnimating] = useState(false);

  return (
    <button
      onClick={() => {
        setAnimating(true);
        onClick();
        setTimeout(() => setAnimating(false), 600);
      }}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-90',
        active
          ? 'text-civic-light bg-civic/10'
          : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
      )}
    >
      <Icon className={clsx('w-4 h-4', animating && 'animate-heart-beat', active && 'text-civic')} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

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
