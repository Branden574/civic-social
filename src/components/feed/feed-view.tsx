'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { PostCard, PostData } from './post-card';
import { BarChart3, Shield, Sparkles, ArrowUp, Clock, Flame, ChevronUp, RefreshCw, Users, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { ComposeModal } from '@/components/compose/compose-modal';
import { usePostStore, type UserPost } from '@/lib/post-store';
import { useAuth } from '@/lib/auth-context';
import { OnboardingCarousel } from '@/components/onboarding/onboarding-carousel';
import { FeedPostsSkeleton } from './feed-skeleton';
import { usePerf, useTrackedFetch } from '@/lib/performance';

// ═══════════════════════════════════════════════════════════════
// X/Twitter-style Timeline Architecture
// ═══════════════════════════════════════════════════════════════
//
// State separation:
//   renderedPosts   — currently visible in the feed (server + user posts)
//   pendingNewIds   — IDs of real new posts detected by polling (not yet shown)
//
// Behavior:
//   1. Poll /api/feed/check-new every 30s for genuinely new posts
//   2. check-new only counts real DB-persisted posts, excludes user's own
//   3. If new posts found: buffer their IDs in pendingNewIds
//   4. Show floating "N new posts" pill only when pendingNewIds.length > 0
//   5. If user is at top: pill still shown (user taps to load)
//   6. On tap: full feed refetch, merge, reset pending count
//   7. Optimistic/temp posts never trigger the pill
//   8. Deduplication by post ID at every merge point
// ═══════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// Avoid the "useLayoutEffect does nothing on the server" warning
// while still restoring scroll before paint on the client.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Canonical ideology order for the viewpoint distribution bar
const IDEOLOGY_ORDER = ['left', 'center-left', 'center', 'center-right', 'right'];

const IDEOLOGY_LABELS: Record<string, string> = {
  left: 'Left',
  'center-left': 'Ctr-left',
  center: 'Center',
  'center-right': 'Ctr-right',
  right: 'Right',
  unknown: 'Unknown',
};

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
  const [fetchError, setFetchError] = useState(false);
  const [showDiversity, setShowDiversity] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const { getPostsForFeed, userPosts, removePost } = usePostStore();
  const { user, isNewUser, onboardingDone, completeOnboarding, refreshMe } = useAuth();
  const { markFirstContent } = usePerf();
  const trackedFetch = useTrackedFetch();
  const feedTopRef = useRef<HTMLDivElement>(null);

  // ─── Pending new posts buffer (X/Twitter-style) ──────────────
  const [pendingNewIds, setPendingNewIds] = useState<string[]>([]);
  const pendingCount = pendingNewIds.length;

  // ─── Scroll position tracking ────────────────────────────────
  // Only the "scrolled past 600px" signal feeds UI (scroll-to-top button);
  // there is no consumer of an at-top flag, so we avoid a per-scroll re-render.

  // ─── Scroll restoration after feed re-render ────────────────
  // When new posts are merged in (refresh after delete, background
  // refetch, etc.) we capture scrollY before swapping the feed and
  // restore it before paint so the viewport doesn't jump.
  const scrollRestoreRef = useRef<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (scrollRestoreRef.current !== null) {
      const y = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
      window.scrollTo(0, y);
    }
  }, [feed]);

  // Track rendered post IDs for dedup in check-new polling
  const renderedIdsRef = useRef<Set<string>>(new Set());

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

  // ─── Initial feed fetch ──────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      const data = await res.json();
      setFeed(data);
      setPendingNewIds([]);
      setLastFetchTime(Date.now());
      setFetchError(false);
      markFirstContent();
    } catch {
      // Feed fetch failed — keep existing feed visible, surface a
      // retryable error state instead of failing silently.
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab, sortMode, coldStartParams, trackedFetch, markFirstContent]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // ─── Scroll tracking ────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Poll for genuinely new posts (30s interval) ─────────────
  // Only counts real DB-persisted posts from OTHER users.
  // Sends currently rendered IDs so server can exclude them.
  useEffect(() => {
    if (loading || lastFetchTime === 0) return;

    const poll = async () => {
      try {
        // Send rendered IDs to exclude (up to 100 to keep URL manageable)
        const ids = Array.from(renderedIdsRef.current).slice(0, 100);
        const excludeParam = ids.length > 0 ? `&excludeIds=${ids.join(',')}` : '';
        const res = await fetch(
          `/api/feed/check-new?since=${lastFetchTime}${excludeParam}&_t=${Date.now()}`,
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.count > 0 && data.postIds?.length > 0) {
          // Filter out any IDs we already have rendered or pending
          const currentRendered = renderedIdsRef.current;
          const genuinelyNew = (data.postIds as string[]).filter(
            (id: string) => !currentRendered.has(id),
          );

          if (genuinelyNew.length > 0) {
            setPendingNewIds((prev) => {
              // Deduplicate with already-pending IDs
              const existing = new Set(prev);
              const fresh = genuinelyNew.filter((id: string) => !existing.has(id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        }
      } catch {
        // Silently skip — next poll will retry
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [lastFetchTime, loading]);

  // ─── Feed refresh (used by pull-to-refresh, manual, and load-new) ──
  // keepScroll (default true) captures scrollY before the feed swap so
  // the viewport position is preserved across the re-render.
  const handleRefresh = useCallback(async (opts?: { keepScroll?: boolean }) => {
    const keepScroll = opts?.keepScroll ?? true;
    setIsRefreshing(true);
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      const data = await res.json();
      if (keepScroll) scrollRestoreRef.current = window.scrollY;
      setFeed(data);
      setPendingNewIds([]);
      setLastFetchTime(Date.now());
      setFetchError(false);
    } catch {
      // Refresh failed — keep existing feed visible, show retry banner
      setFetchError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeTab, sortMode, coldStartParams, trackedFetch]);

  const scrollToTop = () => {
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── "Load new posts" handler (user taps the pill) ──────────
  const handleLoadNewPosts = useCallback(() => {
    // Scroll to top first, then refetch
    scrollToTop();
    // Small delay so the scroll starts before feed replaces.
    // keepScroll: false — the intent here is to land at the top.
    setTimeout(() => {
      handleRefresh({ keepScroll: false });
    }, 150);
  }, [handleRefresh]);

  // ─── Post creation handler (optimistic insert) ──────────────
  const handlePostCreated = useCallback(() => {
    setPendingNewIds([]);
    refreshMe();
    // Refetch feed so server-ranked version appears and dedup works
    handleRefresh({ keepScroll: false });
    setTimeout(() => {
      feedTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  }, [refreshMe, handleRefresh]);

  // ─── Post deletion handler ──────────────────────────────────
  const handlePostDeleted = useCallback(async (postId: string) => {
    removePost(postId);
    setFeed((prev) => prev ? {
      ...prev,
      posts: prev.posts.filter((p) => p.id !== postId),
    } : prev);
    // Also remove from pending if it was there
    setPendingNewIds((prev) => prev.filter((id) => id !== postId));
    refreshMe();
    try {
      const res = await trackedFetch(`/api/feed?tab=${activeTab}&sort=${sortMode}${coldStartParams}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        // Preserve scroll — the user may be deep in the feed
        scrollRestoreRef.current = window.scrollY;
        setFeed(data);
        setLastFetchTime(Date.now());
      }
    } catch {
      // If refetch fails, the optimistic removal still holds
    }
  }, [removePost, activeTab, sortMode, coldStartParams, trackedFetch, refreshMe]);

  // ─── Merge user-created posts into feed (with dedup) ────────
  const mergedPosts: PostData[] = useMemo(() => {
    const serverPosts = feed?.posts ?? [];
    const myPosts = getPostsForFeed(activeTab);

    // Convert UserPost to PostData shape
    const userPostsAsPostData: PostData[] = myPosts
      .filter((p) => !p._failed)
      .map((p: UserPost) => ({
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

    // Deduplicate: server posts win over optimistic (they have real data)
    const serverIds = new Set(serverPosts.map((p) => p.id));
    const uniqueUserPosts = userPostsAsPostData.filter((p) => !serverIds.has(p.id));

    // Final merged list: user's optimistic posts on top, then server posts
    const merged = [...uniqueUserPosts, ...serverPosts];

    // Update rendered IDs ref for poll dedup (only non-optimistic)
    const ids = new Set<string>();
    for (const p of merged) {
      if (!p._optimistic) ids.add(p.id);
    }
    renderedIdsRef.current = ids;

    return merged;
  }, [feed?.posts, getPostsForFeed, activeTab, userPosts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Avg civility across the posts currently shown ──────────
  const avgCivility = useMemo(() => {
    const posts = feed?.posts ?? [];
    const scores = posts
      .map((p) => p.thread?.civilityScore ?? p.algorithm?.signals?.civility)
      .filter((v): v is number => typeof v === 'number');
    if (scores.length === 0) return null;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
  }, [feed?.posts]);

  // Ordered affiliation entries for the viewpoint bar (left → right)
  const affiliationEntries = useMemo(() => {
    const dist = feed?.diversity?.affiliationDistribution ?? {};
    return Object.entries(dist).sort(([a], [b]) => {
      const ia = IDEOLOGY_ORDER.indexOf(a);
      const ib = IDEOLOGY_ORDER.indexOf(b);
      return (ia === -1 ? IDEOLOGY_ORDER.length : ia) - (ib === -1 ? IDEOLOGY_ORDER.length : ib);
    });
  }, [feed?.diversity?.affiliationDistribution]);

  // ─── Should we show the new posts pill? ─────────────────────
  // Only when there are genuinely new posts buffered and the feed
  // is not in its initial loading state.
  const showNewPostsPill = pendingCount > 0 && !loading && !isRefreshing;

  return (
    <div className="max-w-2xl mx-auto relative">
      <div ref={feedTopRef} />

      {/* ── Sticky Glass Header ── */}
      <header className="sticky top-0 z-40 bg-glass backdrop-blur-[16px] border-b border-border-hairline">
        {/* Tab switcher — gold underline on the active tab */}
        <div className="flex" role="tablist" aria-label="Feed tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'for-you'}
            onClick={() => setActiveTab('for-you')}
            className={clsx(
              'relative flex-1 pt-[15px] pb-[13px] text-[15px] font-bold text-center transition-colors cursor-pointer',
              activeTab === 'for-you'
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            For You
            <span
              aria-hidden="true"
              className={clsx(
                'absolute bottom-0 left-1/2 -translate-x-1/2 w-[52px] h-[3px] rounded-full',
                activeTab === 'for-you' ? 'bg-civic' : 'bg-transparent',
              )}
            />
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'following'}
            onClick={() => setActiveTab('following')}
            className={clsx(
              'relative flex-1 pt-[15px] pb-[13px] text-[15px] font-bold text-center transition-colors cursor-pointer',
              activeTab === 'following'
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            Following
            <span
              aria-hidden="true"
              className={clsx(
                'absolute bottom-0 left-1/2 -translate-x-1/2 w-[52px] h-[3px] rounded-full',
                activeTab === 'following' ? 'bg-civic' : 'bg-transparent',
              )}
            />
          </button>
        </div>

        {/* Controls row — Top/Latest segmented control + Feed Health */}
        <div className="flex items-center justify-between px-3.5 py-[7px] border-t border-border-hairline">
          <div
            className="flex items-center gap-[2px] bg-surface-elevated rounded-[10px] p-[2px]"
            role="group"
            aria-label="Sort mode"
          >
            <button
              onClick={() => setSortMode('top')}
              aria-pressed={sortMode === 'top'}
              className={clsx(
                'flex items-center gap-[5px] px-[11px] py-[5px] min-h-[44px] sm:min-h-0 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                sortMode === 'top'
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              <Flame className="w-3 h-3" aria-hidden="true" />
              Top
            </button>
            <button
              onClick={() => setSortMode('latest')}
              aria-pressed={sortMode === 'latest'}
              className={clsx(
                'flex items-center gap-[5px] px-[11px] py-[5px] min-h-[44px] sm:min-h-0 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                sortMode === 'latest'
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              <Clock className="w-3 h-3" aria-hidden="true" />
              Latest
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleRefresh()}
              disabled={isRefreshing}
              aria-label="Refresh feed"
              title="Refresh feed"
              className="flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-[10px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={clsx('w-[15px] h-[15px]', isRefreshing && 'animate-spin')} aria-hidden="true" />
            </button>

            <button
              onClick={() => setShowDiversity(!showDiversity)}
              aria-expanded={showDiversity}
              aria-label="Toggle Feed Health panel"
              className={clsx(
                'flex items-center gap-1.5 px-[11px] py-1.5 min-h-[44px] sm:min-h-0 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer',
                showDiversity
                  ? 'bg-civic-muted text-civic-light'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
            >
              <BarChart3 className="w-[13px] h-[13px]" aria-hidden="true" />
              <span className="hidden sm:inline">Feed Health</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── New Posts Pill (X/Twitter-style, floating, gold) ── */}
      {showNewPostsPill && (
        <div className="sticky top-[108px] z-30 flex justify-center pointer-events-none h-0" aria-live="polite">
          <button
            onClick={handleLoadNewPosts}
            className={clsx(
              'pointer-events-auto',
              'flex items-center gap-[7px] mt-3 px-[18px] py-[9px] min-h-[44px] sm:min-h-0',
              'bg-civic text-[#16130d] text-[13px] font-bold',
              'rounded-full shadow-[var(--sh-lg)]',
              'hover:brightness-105 transition-[filter] duration-150',
              'animate-slide-up cursor-pointer',
            )}
          >
            <ArrowUp className="w-[13px] h-[13px]" strokeWidth={2.4} aria-hidden="true" />
            {pendingCount === 1
              ? '1 new post'
              : `${pendingCount} new posts`}
          </button>
        </div>
      )}

      {/* ── Feed Health Panel ── */}
      {showDiversity && feed?.diversity && (
        <div className="mx-3.5 mt-3 mb-0.5 p-4 bg-surface border border-border-subtle rounded-2xl animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-[15px] h-[15px] text-civic-light shrink-0" aria-hidden="true" />
            <h3 className="text-[13px] font-bold text-text-primary">Feed Health</h3>
            <span className="text-[11.5px] text-text-muted hidden sm:inline">
              Your timeline, measured — not curated in secret
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <HealthStat
              label="Diversity"
              value={`${Math.round(feed.diversity.diversityRatio * 100)}%`}
              sublabel="viewpoint spread"
              tone={feed.diversity.diversityRatio > 0.5 ? 'positive' : 'warning'}
            />
            <HealthStat
              label="Cross-party"
              value={`${Math.round(feed.diversity.crossPartyPercentage * 100)}%`}
              sublabel="multi-perspective"
              tone={feed.diversity.crossPartyPercentage > 0.3 ? 'positive' : 'warning'}
            />
            <HealthStat
              label="Avg civility"
              value={avgCivility !== null ? String(avgCivility) : '—'}
              sublabel="of posts shown"
              tone="neutral"
            />
            <HealthStat
              label="Filtered"
              value={String(feed.meta.filteredCount)}
              sublabel="low-quality posts"
              tone="neutral"
            />
          </div>

          {/* Viewpoint distribution — stacked ideology bar */}
          {affiliationEntries.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-text-muted mb-[7px]">
                Viewpoint Distribution
              </p>
              <div className="flex gap-[2px] h-[7px] rounded-full overflow-hidden">
                {affiliationEntries.map(([aff, pct]) => (
                  <span
                    key={aff}
                    className={getAffiliationBarColor(aff)}
                    style={{ width: `${Math.max(pct * 100, 5)}%` }}
                    title={`${IDEOLOGY_LABELS[aff] ?? aff}: ${Math.round(pct * 100)}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-[13px] gap-y-1.5 mt-[7px]">
                {affiliationEntries.map(([aff, pct]) => (
                  <span key={aff} className="flex items-center gap-[5px] text-[10.5px] text-text-muted">
                    <span
                      className={clsx('w-[7px] h-[7px] rounded-full shrink-0', getAffiliationBarColor(aff))}
                      aria-hidden="true"
                    />
                    {IDEOLOGY_LABELS[aff] ?? aff} {Math.round(pct * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sort Mode Indicator ── */}
      {!loading && feed && (
        <div className="px-[18px] pt-3">
          <p className="text-xs text-text-muted">
            {sortMode === 'top'
              ? 'Ranked by engagement, civility & source quality'
              : 'Newest first — no algorithmic ranking'}
          </p>
        </div>
      )}

      {/* ── Onboarding Carousel (shown until dismissed / completed) ── */}
      {!onboardingDone && <OnboardingCarousel onComplete={completeOnboarding} />}

      {/* ── Loading State (shimmer, card-shaped skeletons) ── */}
      {loading && <FeedPostsSkeleton count={5} />}

      {/* ── Error State (fetch failed, nothing to show) ── */}
      {!loading && !feed && fetchError && (
        <FeedErrorState onRetry={fetchFeed} />
      )}

      {/* ── Refresh-failed banner (feed still visible) ── */}
      {!loading && feed && fetchError && (
        <div className="mx-3.5 mt-3 flex items-center justify-between gap-3 px-4 py-1.5 bg-surface border border-border-subtle rounded-xl animate-fade-in">
          <span className="flex items-center gap-2 text-[12.5px] text-text-secondary">
            <WifiOff className="w-3.5 h-3.5 text-warning-light shrink-0" aria-hidden="true" />
            Couldn&rsquo;t refresh the feed.
          </span>
          <button
            onClick={() => handleRefresh()}
            className="text-[12.5px] font-bold text-civic-light hover:text-civic min-h-[44px] sm:min-h-0 px-1 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Post List with Pull-to-Refresh ── */}
      {!loading && feed && (
        <PullToRefresh onRefresh={() => handleRefresh()}>
          <div className="pt-2">
            {mergedPosts.length === 0 ? (
              activeTab === 'following' ? (
                <FeedEmptyState
                  icon={Users}
                  title="No posts from people you follow yet"
                  text="Follow voices you trust — researchers, local officials, journalists. Their posts will show up here, newest conversations first."
                />
              ) : (
                <FeedEmptyState
                  icon={Sparkles}
                  title="Nothing here yet"
                  text="New posts land here as the community speaks. Pull to refresh, or start the first conversation yourself."
                />
              )
            ) : (
              mergedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={Math.min(i, 8)} onDelete={handlePostDeleted} />
              ))
            )}
          </div>
        </PullToRefresh>
      )}

      {/* ── Jump to Top button (only when scrolled down) ── */}
      {showScrollTop && !showNewPostsPill && (
        <button
          onClick={scrollToTop}
          aria-label="Jump to top"
          title="Jump to top"
          className="fixed bottom-36 right-4 lg:bottom-8 lg:right-8 z-50 w-11 h-11 bg-surface-elevated border border-border-subtle text-text-secondary rounded-full flex items-center justify-center shadow-[var(--sh-lg)] hover:bg-surface-hover hover:text-civic-light transition-colors cursor-pointer"
        >
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* ── Compose Modal ── */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Bottom spacer so the fixed mobile tab bar (~76px) + home-indicator
          safe area never overlap the last post. Collapses on lg (no tab bar). */}
      <div
        className="h-[calc(96px+env(safe-area-inset-bottom,0px))] lg:h-0"
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function HealthStat({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel: string;
  tone: 'positive' | 'warning' | 'neutral';
}) {
  return (
    <div className="px-3 py-2.5 bg-bg-alt rounded-xl">
      <p className="text-[10.5px] font-semibold text-text-muted">{label}</p>
      <p
        className={clsx(
          'text-lg font-bold font-mono leading-snug',
          tone === 'positive' && 'text-positive-light',
          tone === 'warning' && 'text-warning-light',
          tone === 'neutral' && 'text-text-primary',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-text-muted">{sublabel}</p>
    </div>
  );
}

function FeedEmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-10 py-[54px] text-center animate-fade-in">
      <div className="w-[52px] h-[52px] rounded-full bg-surface border border-border-subtle flex items-center justify-center">
        <Icon className="w-[22px] h-[22px] text-text-muted" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="text-[15px] font-bold text-text-primary">{title}</p>
      <p className="text-[13px] leading-relaxed text-text-muted max-w-[340px]">{text}</p>
    </div>
  );
}

function FeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-10 py-[54px] text-center animate-fade-in" role="alert">
      <div className="w-[52px] h-[52px] rounded-full bg-surface border border-border-subtle flex items-center justify-center">
        <WifiOff className="w-[22px] h-[22px] text-text-muted" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="text-[15px] font-bold text-text-primary">Couldn&rsquo;t load your feed</p>
      <p className="text-[13px] leading-relaxed text-text-muted max-w-[340px]">
        Something went wrong on our end or your connection dropped. Your feed is safe — try again.
      </p>
      <button
        onClick={onRetry}
        className="mt-1.5 flex items-center gap-2 px-[18px] py-[9px] min-h-[44px] sm:min-h-0 bg-civic text-[#16130d] text-[13px] font-bold rounded-full hover:brightness-105 transition-[filter] duration-150 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Retry
      </button>
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
