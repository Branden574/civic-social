'use client';

import { useState, useRef, useEffect, memo } from 'react';
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
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { CredibilityMeter, type CredibilityData } from './credibility-meter';
import { ContextPanel } from './context-panel';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';

// ─── Types ───────────────────────────────────────────────────

interface PostAuthor {
  id: string;
  displayName: string;
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
  // Optimistic UI metadata
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

/**
 * Build credibility data from the post's algorithm signals + metadata.
 */
function buildCredibilityData(post: PostData): CredibilityData {
  return {
    sourceCredibility: post.algorithm.signals.sourceCredibility,
    authorReputation: post.algorithm.signals.authorReputation,
    civility: post.algorithm.signals.civility,
    penalty: post.algorithm.signals.penalty,
    sourceCount: post.sources.length,
    hasPrimarySources: post.sources.some((s) => s.trustScore >= 0.9),
    verificationLevel: post.author.verificationLevel,
    flagCount: post.algorithm.signals.penalty > 0.2
      ? Math.round(post.algorithm.signals.penalty * 15)
      : 0,
  };
}

// ─── Post Card Component ─────────────────────────────────────

// Current user ID constant — matches post-store.tsx
const CURRENT_USER_ID = 'user-current';

export const PostCard = memo(function PostCard({ post, index, onDelete }: { post: PostData; index: number; onDelete?: (postId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [openReaction, setOpenReaction] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwnPost = post.author.id === CURRENT_USER_ID;
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setShowDeleteConfirm(false);
        onDelete?.(post.id);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || `Delete failed (${res.status}). Please try again.`);
      }
    } catch {
      setDeleteError('Network error — could not reach server. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const verification = verificationIcons[post.author.verificationLevel];
  const threadType = post.thread ? threadTypeLabels[post.thread.type] : null;
  const ideology = post.author.affiliations[0];
  const ideologyStyle = ideology ? ideologyColors[ideology] : '';
  const credibilityData = buildCredibilityData(post);

  // Truncate content for collapsed view
  const isLong = post.content.length > 300;
  const displayContent = isLong && !expanded
    ? post.content.slice(0, 300) + '...'
    : post.content;

  return (
    <article
      className={clsx(
        'feed-item animate-fade-in opacity-0 border-b border-border-subtle hover:bg-surface/40 transition-colors duration-150',
        post._optimistic && 'opacity-70',
        post._failed && 'opacity-50 border-l-2 border-l-danger',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
    >
      {/* Optimistic posting indicator */}
      {post._optimistic && (
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center gap-1.5 text-[11px] text-text-muted">
          <div className="w-3 h-3 border-2 border-civic/40 border-t-civic rounded-full animate-spin" />
          Posting...
        </div>
      )}
      {/* Failed post banner */}
      {post._failed && (
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center gap-1.5 text-[11px] text-danger-light">
          <span className="font-semibold">Failed to post</span>
          <span className="text-text-muted">— tap to retry or dismiss</span>
        </div>
      )}
      <div className="px-4 sm:px-6 py-5">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar — clickable to profile */}
          <Link
            href={`/profile/${encodeURIComponent(post.author.id)}`}
            className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-sm font-semibold shrink-0 border border-border-subtle hover:border-civic/50 hover:ring-2 hover:ring-civic/20 transition-all cursor-pointer"
          >
            {post.author.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
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
                  <verification.icon
                    className={clsx('w-3.5 h-3.5', verification.color)}
                  />
                </span>
              )}
              {ideology && (
                <span
                  className={clsx(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    ideologyStyle,
                  )}
                >
                  {ideology}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted">
                {formatDistanceToNow(new Date(post.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {threadType && (
                <>
                  <span className="text-text-muted">·</span>
                  <span
                    className={clsx(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                      threadType.color,
                    )}
                  >
                    {threadType.label}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Quality score badge */}
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setShowAlgorithm(!showAlgorithm)}
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

            {/* More options (own posts) */}
            {isOwnPost && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
                  title="More options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Dropdown menu */}
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated rounded-xl border border-border-subtle shadow-lg z-50 animate-fade-in overflow-hidden">
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-danger-light hover:bg-danger/5 transition-colors text-left"
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
          <Link
            href={`/post/${encodeURIComponent(post.id)}`}
            className="block text-[14.5px] leading-relaxed text-text-primary whitespace-pre-line hover:text-text-primary/90 transition-colors cursor-pointer"
          >
            {displayContent}
          </Link>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-civic-light text-sm font-medium mt-1 hover:underline flex items-center gap-1"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}

          {/* ── Clickable Hashtags ── */}
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

          {/* ── Credibility Meter ── */}
          <CredibilityMeter data={credibilityData} />

          {/* ── Context Panel (for polarizing topics) ── */}
          <ContextPanel topics={post.topics} />

          {/* ── Sources ── */}
          {post.sources.length > 0 && (
            <div className="mt-3 space-y-1">
              {post.sources.map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-text-secondary hover:text-civic-light transition-colors group"
                >
                  <ExternalLink className="w-3 h-3 text-text-muted group-hover:text-civic-light" />
                  <span className="truncate">{source.domain}</span>
                  <span
                    className={clsx(
                      'text-[9px] font-semibold px-1 py-0.5 rounded',
                      source.trustScore >= 0.8
                        ? 'bg-positive/10 text-positive-light'
                        : source.trustScore >= 0.5
                          ? 'bg-warning/10 text-warning-light'
                          : 'bg-danger/10 text-danger-light',
                    )}
                  >
                    Trust: {Math.round(source.trustScore * 100)}%
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* ── Thread info ── */}
          {post.thread && (
            <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {post.thread.participantCount} participants
              </span>
              <span className="flex items-center gap-1">
                Civility:{' '}
                <span
                  className={clsx(
                    'font-semibold',
                    post.thread.civilityScore >= 0.7
                      ? 'text-civility-high'
                      : post.thread.civilityScore >= 0.4
                        ? 'text-civility-medium'
                        : 'text-civility-low',
                  )}
                >
                  {Math.round(post.thread.civilityScore * 100)}%
                </span>
              </span>
              <span className="flex items-center gap-1">
                Diversity:{' '}
                <span className="font-semibold text-civic-light">
                  {Math.round(post.thread.diversityScore * 100)}%
                </span>
              </span>
            </div>
          )}

          {/* ── Reactions Bar ── */}
          <div className="flex items-center gap-1 mt-4 flex-wrap">
            <SmartReactionButton
              icon={ThumbsUp}
              label="Agree"
              count={post.reactions.agree}
              color="text-positive"
              bgColor="bg-positive"
              isOpen={openReaction === 'agree'}
              onToggle={() => setOpenReaction(openReaction === 'agree' ? null : 'agree')}
            />
            <SmartReactionButton
              icon={ThumbsDown}
              label="Disagree"
              count={post.reactions.disagree}
              color="text-danger"
              bgColor="bg-danger"
              isOpen={openReaction === 'disagree'}
              onToggle={() => setOpenReaction(openReaction === 'disagree' ? null : 'disagree')}
            />
            <SmartReactionButton
              icon={Lightbulb}
              label="Insightful"
              count={post.reactions.insightful}
              color="text-warning"
              bgColor="bg-warning"
              isOpen={openReaction === 'insightful'}
              onToggle={() => setOpenReaction(openReaction === 'insightful' ? null : 'insightful')}
            />
            <SmartReactionButton
              icon={Layers}
              label="Nuance"
              count={post.reactions.nuance}
              color="text-civic-light"
              bgColor="bg-civic"
              isOpen={openReaction === 'nuance'}
              onToggle={() => setOpenReaction(openReaction === 'nuance' ? null : 'nuance')}
            />

            <div className="flex-1" />

            {/* ── Reply / Comment button ── */}
            <Link
              href={`/post/${post.id}`}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md transition-colors',
                post.comment_policy === 'off' || post.is_thread_locked
                  ? 'text-text-muted/50 cursor-default'
                  : 'text-text-muted hover:text-civic-light hover:bg-surface-hover',
              )}
              title={
                post.is_thread_locked ? 'Thread locked' :
                post.comment_policy === 'off' ? 'Comments turned off by author' :
                post.comment_policy === 'followers_only' ? 'Followers only' :
                'Reply'
              }
              onClick={(e) => {
                if (post.comment_policy === 'off' || post.is_thread_locked) e.preventDefault();
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {(() => {
                const count = post.comment_count ?? post.replies?.length ?? 0;
                return count > 0 ? count : 'Reply';
              })()}
            </Link>

            <button
              onClick={() => setBookmarked(!bookmarked)}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                bookmarked
                  ? 'text-civic-light bg-civic/10'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title={bookmarked ? 'Remove bookmark' : 'Save post'}
            >
              {bookmarked ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowReport(!showReport)}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                showReport
                  ? 'text-danger-light bg-danger/10'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Report content"
            >
              <Flag className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors" title="Share">
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAlgorithm(!showAlgorithm)}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                showAlgorithm
                  ? 'text-civic-light bg-civic/10'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Why am I seeing this?"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* ── Reaction Reasons Panel (expandable) ── */}
          {openReaction && (
            <ReactionReasonsPanel
              reactionType={openReaction}
              post={post}
              onClose={() => setOpenReaction(null)}
            />
          )}

          {/* ── Inline Report Panel ── */}
          {showReport && (
            <InlineReportPanel postId={post.id} onClose={() => setShowReport(false)} />
          )}

          {/* ── Algorithm Explanation (expandable) ── */}
          {showAlgorithm && (
            <AlgorithmExplainer algorithm={post.algorithm} />
          )}

          {/* ── Replies (expandable) ── */}
          {showReplies && post.replies.length > 0 && (
            <div className="mt-4 space-y-3 border-l-2 border-border-subtle pl-4 animate-fade-in">
              {post.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Delete Confirmation Modal (Portal) ═══ */}
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

// ─── Sub-components ──────────────────────────────────────────

// ─── Reaction Reasons Data ────────────────────────────────────

interface ReactionReason {
  id: string;
  label: string;
  /** Which algorithm signal this reason affects */
  signal: string;
  /** Direction: positive means it boosts the signal, negative means it reduces */
  direction: 'positive' | 'negative';
}

const REACTION_REASONS: Record<string, ReactionReason[]> = {
  agree: [
    { id: 'well-sourced', label: 'Well-sourced & cited', signal: 'sourceCredibility', direction: 'positive' },
    { id: 'solution-oriented', label: 'Solution-oriented thinking', signal: 'civility', direction: 'positive' },
    { id: 'changed-perspective', label: 'Changed my perspective', signal: 'viewpointDiversity', direction: 'positive' },
    { id: 'fair-to-all', label: 'Fair to all sides', signal: 'civility', direction: 'positive' },
    { id: 'expert-analysis', label: 'Expert-level analysis', signal: 'authorReputation', direction: 'positive' },
    { id: 'strong-evidence', label: 'Strong evidence presented', signal: 'sourceCredibility', direction: 'positive' },
  ],
  disagree: [
    { id: 'missing-sources', label: 'Missing credible sources', signal: 'sourceCredibility', direction: 'negative' },
    { id: 'misleading-claims', label: 'Contains misleading claims', signal: 'penalty', direction: 'negative' },
    { id: 'ignores-counter', label: 'Ignores key counter-arguments', signal: 'viewpointDiversity', direction: 'negative' },
    { id: 'one-sided', label: 'One-sided perspective', signal: 'viewpointDiversity', direction: 'negative' },
    { id: 'inflammatory', label: 'Uses inflammatory language', signal: 'civility', direction: 'negative' },
    { id: 'logical-fallacy', label: 'Logical fallacy detected', signal: 'engagementQuality', direction: 'negative' },
  ],
  insightful: [
    { id: 'new-perspective', label: 'Offers new perspective', signal: 'viewpointDiversity', direction: 'positive' },
    { id: 'data-driven', label: 'Data-driven analysis', signal: 'sourceCredibility', direction: 'positive' },
    { id: 'bridges-divide', label: 'Bridges political divide', signal: 'viewpointDiversity', direction: 'positive' },
    { id: 'domain-expertise', label: 'Deep domain expertise', signal: 'authorReputation', direction: 'positive' },
    { id: 'unexpected-connection', label: 'Connects unexpected dots', signal: 'engagementQuality', direction: 'positive' },
  ],
  nuance: [
    { id: 'missing-context', label: 'Adds missing context', signal: 'engagementQuality', direction: 'positive' },
    { id: 'trade-offs', label: 'Considers trade-offs', signal: 'civility', direction: 'positive' },
    { id: 'complexity', label: 'Acknowledges complexity', signal: 'civility', direction: 'positive' },
    { id: 'competing-values', label: 'Balances competing values', signal: 'viewpointDiversity', direction: 'positive' },
    { id: 'overlooked-factors', label: 'Highlights overlooked factors', signal: 'engagementQuality', direction: 'positive' },
  ],
};

const SIGNAL_LABELS: Record<string, { label: string; color: string }> = {
  sourceCredibility: { label: 'Source Credibility', color: 'text-warning-light' },
  civility: { label: 'Civility Score', color: 'text-positive-light' },
  viewpointDiversity: { label: 'Viewpoint Diversity', color: 'text-civic-light' },
  engagementQuality: { label: 'Engagement Quality', color: 'text-info-light' },
  authorReputation: { label: 'Author Reputation', color: 'text-info-light' },
  penalty: { label: 'Content Flags', color: 'text-danger-light' },
};

/**
 * Generate mock community reason stats based on post signals.
 * In production, these would come from the API.
 */
function generateCommunityReasons(post: PostData, reactionType: string): Record<string, number> {
  const reasons = REACTION_REASONS[reactionType] || [];
  const signals = post.algorithm.signals;
  const stats: Record<string, number> = {};
  const total = (() => {
    switch (reactionType) {
      case 'agree': return post.reactions.agree;
      case 'disagree': return post.reactions.disagree;
      case 'insightful': return post.reactions.insightful;
      case 'nuance': return post.reactions.nuance;
      default: return 10;
    }
  })();

  for (const reason of reasons) {
    // Weight based on relevant signal value
    const signalVal = (signals as Record<string, number>)[reason.signal] || 0.5;
    const weight = reason.direction === 'positive' ? signalVal : (1 - signalVal);
    // Generate a plausible count
    stats[reason.id] = Math.max(1, Math.round(total * weight * (0.3 + Math.random() * 0.4)));
  }
  return stats;
}

// ─── Smart Reaction Button ───────────────────────────────────

function SmartReactionButton({
  icon: Icon,
  label,
  count,
  color,
  bgColor,
  isOpen,
  onToggle,
}: {
  icon: typeof ThumbsUp;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [active, setActive] = useState(false);

  const handleClick = () => {
    if (!active) {
      setActive(true);
      onToggle(); // Open reasons panel
    } else {
      // If already active and panel is open, close it
      // If panel is closed, reopen it
      onToggle();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all duration-150',
        active || isOpen
          ? `${color} bg-surface-active font-semibold`
          : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
      )}
      title={`${label} — click to see why`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{formatNumber(count + (active ? 1 : 0))}</span>
    </button>
  );
}

// ─── Reaction Reasons Panel ──────────────────────────────────

function ReactionReasonsPanel({
  reactionType,
  post,
  onClose,
}: {
  reactionType: string;
  post: PostData;
  onClose: () => void;
}) {
  const reasons = REACTION_REASONS[reactionType] || [];
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const communityStats = generateCommunityReasons(post, reactionType);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleReason = (id: string) => {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  // Compute which signals are affected by selected reasons
  const affectedSignals = new Map<string, { direction: 'positive' | 'negative'; count: number }>();
  for (const reason of reasons) {
    if (selectedReasons.has(reason.id)) {
      const existing = affectedSignals.get(reason.signal);
      if (existing) {
        existing.count++;
      } else {
        affectedSignals.set(reason.signal, { direction: reason.direction, count: 1 });
      }
    }
  }

  const reactionLabels: Record<string, { label: string; color: string; icon: typeof ThumbsUp }> = {
    agree: { label: 'Agree', color: 'text-positive-light', icon: ThumbsUp },
    disagree: { label: 'Disagree', color: 'text-danger-light', icon: ThumbsDown },
    insightful: { label: 'Insightful', color: 'text-warning-light', icon: Lightbulb },
    nuance: { label: 'Add Nuance', color: 'text-civic-light', icon: Layers },
  };

  const meta = reactionLabels[reactionType] || reactionLabels.agree;
  const ReactionIcon = meta.icon;

  // Find the most popular community reason
  const topCommunityReason = reasons.reduce(
    (top, r) => ((communityStats[r.id] || 0) > (communityStats[top?.id || ''] || 0) ? r : top),
    reasons[0],
  );
  const totalCommunityVotes = Object.values(communityStats).reduce((a, b) => a + b, 0);

  return (
    <div
      ref={panelRef}
      className="mt-3 bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden animate-slide-up"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <ReactionIcon className={clsx('w-4 h-4', meta.color)} />
          <span className={clsx('text-xs font-semibold', meta.color)}>
            Why do you {meta.label.toLowerCase()}?
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4">
        {!submitted ? (
          <>
            {/* Reason checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
              {reasons.map((reason) => {
                const isSelected = selectedReasons.has(reason.id);
                const communityCount = communityStats[reason.id] || 0;
                const communityPct = totalCommunityVotes > 0
                  ? Math.round((communityCount / totalCommunityVotes) * 100)
                  : 0;

                return (
                  <button
                    key={reason.id}
                    onClick={() => toggleReason(reason.id)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs',
                      isSelected
                        ? 'bg-civic/10 border border-civic/30 text-text-primary'
                        : 'bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <div
                      className={clsx(
                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        isSelected
                          ? 'bg-civic border-civic text-white'
                          : 'border-border-strong',
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span className="flex-1">{reason.label}</span>
                    <span className="text-[10px] text-text-muted font-mono shrink-0">
                      {communityPct}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Algorithm impact preview */}
            {selectedReasons.size > 0 && (
              <div className="mb-3 p-2.5 bg-surface rounded-lg border border-border-subtle animate-fade-in">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Algorithm Impact
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(affectedSignals.entries()).map(([signal, info]) => {
                    const signalMeta = SIGNAL_LABELS[signal];
                    return (
                      <span
                        key={signal}
                        className={clsx(
                          'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
                          info.direction === 'positive'
                            ? 'bg-positive/10 text-positive-light'
                            : 'bg-danger/10 text-danger-light',
                        )}
                      >
                        {info.direction === 'positive' ? '↑' : '↓'}
                        {signalMeta?.label || signal}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">
                  Your feedback helps the algorithm rank content more accurately for everyone.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={selectedReasons.size === 0}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                selectedReasons.size > 0
                  ? 'bg-civic text-white hover:bg-civic-dark'
                  : 'bg-surface-active text-text-muted cursor-not-allowed',
              )}
            >
              Submit Feedback
              {selectedReasons.size > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                  {selectedReasons.size} selected
                </span>
              )}
            </button>
          </>
        ) : (
          /* ── Post-submission: show community stats ── */
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-positive-light" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Thanks for your feedback!</p>
                <p className="text-[11px] text-text-muted">
                  Your reasons have been recorded and will refine the algorithm.
                </p>
              </div>
            </div>

            {/* Community breakdown */}
            <div className="p-3 bg-surface rounded-lg border border-border-subtle">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                What the Community Thinks
              </p>
              <div className="space-y-1.5">
                {reasons
                  .sort((a, b) => (communityStats[b.id] || 0) - (communityStats[a.id] || 0))
                  .map((reason) => {
                    const count = communityStats[reason.id] || 0;
                    const pct = totalCommunityVotes > 0
                      ? (count / totalCommunityVotes) * 100
                      : 0;
                    const isYours = selectedReasons.has(reason.id);
                    const signalMeta = SIGNAL_LABELS[reason.signal];

                    return (
                      <div key={reason.id} className="flex items-center gap-2">
                        <span className={clsx(
                          'text-[11px] w-36 shrink-0 truncate',
                          isYours ? 'text-text-primary font-medium' : 'text-text-secondary',
                        )}>
                          {isYours && <span className="text-civic-light mr-1">•</span>}
                          {reason.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all duration-700',
                              reason.direction === 'positive' ? 'bg-civic' : 'bg-danger',
                            )}
                            style={{ width: `${Math.round(pct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-muted w-8 text-right">
                          {Math.round(pct)}%
                        </span>
                        <span className={clsx(
                          'text-[8px] font-medium px-1 rounded',
                          reason.direction === 'positive'
                            ? 'text-positive-light'
                            : 'text-danger-light',
                        )}>
                          {reason.direction === 'positive' ? '↑' : '↓'}{signalMeta?.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Signals affected summary */}
            {affectedSignals.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[10px] text-text-muted">Your impact:</span>
                {Array.from(affectedSignals.entries()).map(([signal, info]) => {
                  const signalMeta = SIGNAL_LABELS[signal];
                  return (
                    <span
                      key={signal}
                      className={clsx(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        info.direction === 'positive'
                          ? 'bg-positive/10 text-positive-light'
                          : 'bg-danger/10 text-danger-light',
                      )}
                    >
                      {info.direction === 'positive' ? '↑' : '↓'} {signalMeta?.label || signal}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AlgorithmExplainer({ algorithm }: { algorithm: PostAlgorithm }) {
  const signals = algorithm.signals;

  return (
    <div className="mt-4 p-4 bg-surface-elevated rounded-xl border border-border-subtle animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-civic-light" />
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Why am I seeing this?
        </h4>
      </div>

      <p className="text-sm text-text-secondary mb-4">{algorithm.explanation}</p>

      {/* Signal bars */}
      <div className="space-y-2">
        <SignalBar label="Civility" value={signals.civility} weight="25%" color="bg-positive" />
        <SignalBar label="Engagement Quality" value={signals.engagementQuality} weight="20%" color="bg-info" />
        <SignalBar label="Viewpoint Diversity" value={signals.viewpointDiversity} weight="15%" color="bg-civic" />
        <SignalBar label="Source Credibility" value={signals.sourceCredibility} weight="15%" color="bg-warning" />
        <SignalBar label="Topic Relevance" value={signals.topicRelevance} weight="15%" color="bg-civic-light" />
        <SignalBar label="Author Reputation" value={signals.authorReputation} weight="10%" color="bg-info-light" />
        {signals.penalty > 0 && (
          <SignalBar label="Penalty" value={signals.penalty} weight="SUB" color="bg-danger" isNegative />
        )}
      </div>

      {/* Tags */}
      {algorithm.explanationTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-subtle">
          {algorithm.explanationTags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-text-muted bg-surface-active px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalBar({
  label,
  value,
  weight,
  color,
  isNegative,
}: {
  label: string;
  value: number;
  weight: string;
  color: string;
  isNegative?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-text-muted w-32 shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span
        className={clsx(
          'text-[11px] font-mono w-10 text-right',
          isNegative ? 'text-danger-light' : 'text-text-secondary',
        )}
      >
        {isNegative ? '-' : ''}
        {Math.round(value * 100)}%
      </span>
      <span className="text-[9px] text-text-muted w-8 text-right">{weight}</span>
    </div>
  );
}

// ─── Inline Report Panel ─────────────────────────────────────

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

  const selectedCategory = REPORT_CATEGORIES.find((c) => c.id === selected);
  const severityColor = selectedCategory?.severity === 'high'
    ? 'text-danger-light'
    : selectedCategory?.severity === 'medium'
      ? 'text-warning-light'
      : 'text-text-muted';

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
          {selectedCategory && (
            <span className={clsx('text-[10px] font-medium', severityColor)}>
              {selectedCategory.severity === 'high' ? 'Urgent' : selectedCategory.severity === 'medium' ? 'Review' : 'Low'}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-1.5">
        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat.id)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all',
              selected === cat.id
                ? 'bg-civic/10 border border-civic/30 text-text-primary'
                : 'bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover',
            )}
          >
            <div className={clsx(
              'w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0',
              selected === cat.id ? 'bg-civic border-civic' : 'border-border-strong',
            )}>
              {selected === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            {cat.label}
            <span className={clsx(
              'ml-auto text-[9px] font-medium',
              cat.severity === 'high' ? 'text-danger-light' : cat.severity === 'medium' ? 'text-warning-light' : 'text-text-muted',
            )}>
              {cat.severity}
            </span>
          </button>
        ))}
        <button
          onClick={() => selected && setSubmitted(true)}
          disabled={!selected}
          className={clsx(
            'w-full mt-2 py-2 rounded-lg text-xs font-semibold transition-all',
            selected ? 'bg-danger text-white hover:bg-danger/80' : 'bg-surface-active text-text-muted cursor-not-allowed',
          )}
        >
          Submit Report
        </button>
        <p className="text-[10px] text-text-muted text-center mt-1">
          Your report credibility score affects review priority
        </p>
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
        <div className="w-6 h-6 rounded-full bg-surface-active flex items-center justify-center text-text-muted text-[10px] font-semibold">
          {reply.author.displayName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </div>
        <span className="text-xs font-semibold text-text-primary">
          {reply.author.displayName}
        </span>
        {verification && (
          <verification.icon
            className={clsx('w-3 h-3', verification.color)}
          />
        )}
        {ideology && (
          <span
            className={clsx(
              'text-[9px] font-medium px-1 py-0.5 rounded-full',
              ideologyStyle,
            )}
          >
            {ideology}
          </span>
        )}
        <span className="text-[11px] text-text-muted">
          {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-[13px] text-text-secondary leading-relaxed ml-8">
        {reply.content}
      </p>
      <div className="flex items-center gap-3 mt-1.5 ml-8">
        <span className="text-[11px] text-text-muted flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" /> {reply.reactions.agree}
        </span>
        <span className="text-[11px] text-text-muted flex items-center gap-1">
          <Lightbulb className="w-3 h-3" /> {reply.reactions.insightful}
        </span>
        <span
          className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            reply.civilityScore >= 0.8
              ? 'bg-positive/10 text-positive-light'
              : 'bg-warning/10 text-warning-light',
          )}
        >
          Civility: {Math.round(reply.civilityScore * 100)}%
        </span>
      </div>
    </div>
  );
}
