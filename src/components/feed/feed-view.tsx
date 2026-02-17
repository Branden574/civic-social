'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PostCard, PostData } from './post-card';
import { TrendingUp, BarChart3, Shield, Sparkles, ArrowUp, Clock, Flame, ChevronUp, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { ComposeModal } from '@/components/compose/compose-modal';
import { usePostStore, type UserPost } from '@/lib/post-store';
import { useAuth } from '@/lib/auth-context';
import { OnboardingCarousel } from '@/components/onboarding/onboarding-carousel';
import { FeedSkeleton } from '@/components/ui/skeleton';
import { usePerf, useTrackedFetch } from '@/lib/performance';

interface FeedDiversity {
  affiliationDistribution: Record<string, number>;
  shannonEntropy: number;
  diversityRatio: number;
  threadTypeCount: number;
  crossPartyPercentage: number;
  totalPosts: number;
}

interface FeedResponse {
  tab: string;
  posts: PostData[];
  diversity: FeedDiversity;
  meta: {
    totalCandidates: number;
    filteredCount: number;
  };
}

export function FeedView() {
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [sortMode, setSortMode] = useState<'top' | 'latest'>('top');
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDiversity, setShowDiversity] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const { getPostsForFeed, userPosts, removePost } = usePostStore();
  const { user, isNewUser } = useAuth();
  const { markFirstContent } = usePerf();
  const trackedFetch = useTrackedFetch();
  const feedTopRef = useRef<HTMLDivElement>(null);
  const feedVersionRef = useRef(0);

  // Build cold-start query params if new user
  const coldStartParams = useMemo(() => {
    if (!isNewUser || !user) return '';
    const params = new URLSearchParams();
    params.set('newUser', 'true');
    const onboarding = user.onboarding;
    if (onboarding?.topics?.length) params.set('topics', onboarding.topics.join(','));
    if (onboarding?.country) params.set('country', onboarding.country);
    if (onboarding?.affiliation) params.set('affiliation', onboarding.affiliation);
    const daysSinceSignup = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    params.set('days', String(daysSinceSignup));
    return '&' + params.toString();
  }, [isNewUser, user]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      const data = await res.json();
      setFeed(data);
      setHasNewPosts(false);
      setLastFetchTime(Date.now());
      feedVersionRef.current++;
      markFirstContent();
    } catch (err) {
      console.error('Feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, sortMode, coldStartParams, trackedFetch, markFirstContent]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const [newPostCount, setNewPostCount] = useState(0);

  // Poll server for genuinely new posts every 12 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!loading && lastFetchTime > 0) {
        try {
          const res = await fetch(
            `/api/feed/check-new?since=${lastFetchTime}&tab=${activeTab}&_t=${Date.now()}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.count > 0) {
              setHasNewPosts(true);
              setNewPostCount(data.count);
            }
          }
        } catch {
          // Silently skip — next poll will retry
        }
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [lastFetchTime, loading, activeTab]);

  // Show "jump to top" button on scroll
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      const data = await res.json();
      setFeed(data);
      setHasNewPosts(false);
      setLastFetchTime(Date.now());
      feedVersionRef.current++;
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, sortMode, coldStartParams, trackedFetch]);

  const handleManualRefresh = useCallback(async () => {
    await handleRefresh();
  }, [handleRefresh]);

  const scrollToTop = () => {
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLoadNewPosts = () => {
    setHasNewPosts(false);
    setNewPostCount(0);
    handleRefresh();
    scrollToTop();
  };

  // Called when a new post is created via ComposeModal
  const handlePostCreated = useCallback(() => {
    // Reset the "new posts" timer so banner doesn't flash immediately
    setLastFetchTime(Date.now());
    setHasNewPosts(false);
    // Scroll to top to show the new post
    setTimeout(() => {
      feedTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Called when a post is deleted — remove from client + refetch server truth
  const handlePostDeleted = useCallback(async (postId: string) => {
    // 1. Remove from client-side user post store (user-created posts)
    removePost(postId);
    // 2. Immediately filter out of current feed state (optimistic)
    setFeed((prev) => prev ? {
      ...prev,
      posts: prev.posts.filter((p) => p.id !== postId),
    } : prev);
    // 3. Refetch from server to get the authoritative state
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
        setLastFetchTime(Date.now());
        feedVersionRef.current++;
      }
    } catch {
      // If refetch fails, the optimistic removal still holds
    }
  }, [removePost, activeTab, sortMode, coldStartParams, trackedFetch]);

  // ─── Merge user-created posts into feed ────────────────────
  const mergedPosts: PostData[] = useMemo(() => {
    const serverPosts = feed?.posts ?? [];
    const myPosts = getPostsForFeed(activeTab);

    if (myPosts.length === 0) return serverPosts;

    // Convert UserPost to PostData shape
    const userPostsAsPostData: PostData[] = myPosts.map((p: UserPost) => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      topics: p.topics,
      author: p.author,
      thread: p.thread,
      sources: p.sources,
      reactions: p.reactions,
      algorithm: p.algorithm,
      replies: p.replies as PostData['replies'],
      _optimistic: p._optimistic,
      _failed: p._failed,
    }));

    // Deduplicate (in case server returns the same post)
    const serverIds = new Set(serverPosts.map((p) => p.id));
    const uniqueUserPosts = userPostsAsPostData.filter((p) => !serverIds.has(p.id));

    // User posts on top, then server posts
    return [...uniqueUserPosts, ...serverPosts];
  }, [feed?.posts, getPostsForFeed, activeTab, userPosts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-2xl mx-auto relative">
      <div ref={feedTopRef} />

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-0">
          <h2 className="text-lg font-bold text-text-primary lg:hidden">
            Civic Social
          </h2>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1.5">
            {/* Sort mode toggle */}
            <div className="flex items-center bg-surface-elevated rounded-lg border border-border-subtle overflow-hidden">
              <button
                onClick={() => setSortMode('top')}
                className={clsx(
                  'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 transition-colors',
                  sortMode === 'top'
                    ? 'bg-civic/15 text-civic-light'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <Flame className="w-3 h-3" />
                Top
              </button>
              <button
                onClick={() => setSortMode('latest')}
                className={clsx(
                  'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 transition-colors',
                  sortMode === 'latest'
                    ? 'bg-civic/15 text-civic-light'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                <Clock className="w-3 h-3" />
                Latest
              </button>
            </div>

            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-text-muted hover:text-civic-light hover:bg-surface-hover transition-colors disabled:opacity-50"
              title="Refresh feed"
            >
              <RefreshCw className={clsx('w-4 h-4', isRefreshing && 'animate-spin')} />
            </button>

            {/* Removed: theme toggle moved to Settings > Appearance */}
            <button
              onClick={() => setShowDiversity(!showDiversity)}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                showDiversity
                  ? 'bg-civic/10 text-civic-light'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Feed Health</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex px-4 sm:px-6 mt-2">
          <button
            onClick={() => setActiveTab('for-you')}
            className={clsx(
              'flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2',
              activeTab === 'for-you'
                ? 'text-text-primary border-civic'
                : 'text-text-muted border-transparent hover:text-text-secondary',
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              For You
            </span>
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={clsx(
              'flex-1 pb-3 text-sm font-semibold text-center transition-colors border-b-2',
              activeTab === 'following'
                ? 'text-text-primary border-civic'
                : 'text-text-muted border-transparent hover:text-text-secondary',
            )}
          >
            Following
          </button>
        </div>
      </header>

      {/* ── Sort Mode Indicator ── */}
      {!loading && feed && (
        <div className="mx-4 sm:mx-6 mt-2.5 mb-0">
          <div className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
            sortMode === 'top'
              ? 'bg-civic/8 text-civic-light border-civic/20'
              : 'bg-surface-elevated text-text-muted border-border-subtle',
          )}>
            {sortMode === 'top' ? (
              <>
                <Flame className="w-3 h-3" />
                Ranked by engagement, civility &amp; source quality
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                Showing newest first — no algorithmic ranking
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Onboarding Carousel (new users only) ── */}
      {isNewUser && <OnboardingCarousel />}

      {/* ── New Posts Banner ── */}
      {hasNewPosts && (
        <button
          onClick={handleLoadNewPosts}
          className="sticky top-[105px] z-30 w-full flex items-center justify-center gap-2 py-2.5 bg-civic text-white text-sm font-semibold hover:bg-civic-dark transition-all animate-slide-down cursor-pointer"
        >
          <ArrowUp className="w-4 h-4" />
          {newPostCount > 1
            ? `${newPostCount} new posts available — tap to load`
            : 'New post available — tap to load'}
        </button>
      )}

      {/* ── Feed Diversity Panel ── */}
      {showDiversity && feed?.diversity && (
        <div className="mx-4 sm:mx-6 mt-4 p-4 bg-surface-elevated rounded-xl border border-border-subtle animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-civic-light" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              Feed Health Dashboard
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Diversity Score"
              value={`${Math.round(feed.diversity.diversityRatio * 100)}%`}
              sublabel="Shannon entropy ratio"
              good={feed.diversity.diversityRatio > 0.5}
            />
            <MetricCard
              label="Cross-Party"
              value={`${Math.round(feed.diversity.crossPartyPercentage * 100)}%`}
              sublabel="Posts with multi-perspective engagement"
              good={feed.diversity.crossPartyPercentage > 0.3}
            />
            <MetricCard
              label="Thread Types"
              value={feed.diversity.threadTypeCount.toString()}
              sublabel="Distinct conversation formats"
              good={feed.diversity.threadTypeCount >= 3}
            />
            <MetricCard
              label="Filtered"
              value={feed.meta.filteredCount.toString()}
              sublabel="Low-quality posts removed"
              good={true}
            />
          </div>

          {/* Affiliation distribution */}
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Viewpoint Distribution
            </p>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden">
              {Object.entries(feed.diversity.affiliationDistribution).map(
                ([aff, pct]) => (
                  <div
                    key={aff}
                    className={clsx('rounded-full transition-all', getAffiliationBarColor(aff))}
                    style={{ width: `${Math.max(pct * 100, 5)}%` }}
                    title={`${aff}: ${Math.round(pct * 100)}%`}
                  />
                ),
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {Object.entries(feed.diversity.affiliationDistribution).map(
                ([aff, pct]) => (
                  <span key={aff} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <span className={clsx('w-2 h-2 rounded-full', getAffiliationBarColor(aff))} />
                    {aff}: {Math.round(pct * 100)}%
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading State (skeleton with shimmer) ── */}
      {loading && <FeedSkeleton count={5} />}

      {/* ── Post List with Pull-to-Refresh ── */}
      {!loading && feed && (
        <PullToRefresh onRefresh={handleRefresh}>
          <div>
            {mergedPosts.length === 0 ? (
              <div className="px-4 sm:px-6 py-16 text-center">
                <TrendingUp className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary">
                  {activeTab === 'following'
                    ? "No posts from people you follow yet."
                    : "No posts to show."}
                </p>
              </div>
            ) : (
              mergedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={Math.min(i, 8)} onDelete={handlePostDeleted} />
              ))
            )}
          </div>
        </PullToRefresh>
      )}

      {/* ── Jump to Latest / Scroll to Top ── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-36 right-4 lg:bottom-8 lg:right-8 z-50 w-10 h-10 bg-surface-elevated border border-border-subtle text-text-secondary rounded-full flex items-center justify-center shadow-lg hover:bg-surface-hover hover:text-civic-light transition-all active:scale-95"
          title="Jump to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* ── Compose Modal ── */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Bottom spacer for mobile nav */}
      <div className="h-24 lg:h-0" />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
  good,
}: {
  label: string;
  value: string;
  sublabel: string;
  good: boolean;
}) {
  return (
    <div className="p-2.5 bg-surface rounded-lg">
      <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
        {label}
      </p>
      <p
        className={clsx(
          'text-lg font-bold mt-0.5',
          good ? 'text-positive-light' : 'text-warning-light',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-text-muted mt-0.5">{sublabel}</p>
    </div>
  );
}

function getAffiliationBarColor(aff: string): string {
  const map: Record<string, string> = {
    left: 'bg-ideology-left',
    'center-left': 'bg-ideology-center-left',
    center: 'bg-ideology-center',
    'center-right': 'bg-ideology-center-right',
    right: 'bg-ideology-right',
    unknown: 'bg-text-muted',
  };
  return map[aff] || 'bg-text-muted';
}
