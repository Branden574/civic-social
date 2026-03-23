'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import {
  User,
  TrendingUp,
  Settings,
  Calendar,
  MapPin,
  ExternalLink,
  MessageSquare,
  Info,
  BarChart3,
  CheckCircle2,
  PenLine,
  Loader2,
  X,
  RefreshCw,
  Search,
  UserMinus,
} from 'lucide-react';
import clsx from 'clsx';
import { usePostStore, type UserPost } from '@/lib/post-store';
import { PostCard, type PostData } from '@/components/feed/post-card';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { CredibilityBadge } from '@/components/ui/credibility-badge';
import { AuthGate } from '@/components/auth/auth-gate';

const PULL_THRESHOLD = 72;
const PULL_MAX = 120;

type ProfileTab = 'posts' | 'overview' | 'debates' | 'activity' | 'credibility';

interface ConnectionUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  verificationLevel: string;
  credibilityScore: number;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [profileCardDismissed, setProfileCardDismissed] = useState(() => {
    try { return localStorage.getItem('profile_card_dismissed') === 'true'; } catch { return false; }
  });
  const [connectionsPanel, setConnectionsPanel] = useState<'followers' | 'following' | null>(null);
  const [connectionsList, setConnectionsList] = useState<ConnectionUser[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsSearch, setConnectionsSearch] = useState('');
  const { getPostsForProfile, postCount, hydrated, refresh: refreshPosts, removePost } = usePostStore();
  const { user, isAuthenticated, isLoading: authLoading, onboardingDone, profileCompletion, stats, refreshMe } = useAuth();
  const router = useRouter();

  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollStartY = useRef(0);
  const currentPullY = useRef(0);

  const runRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshMe(), refreshPosts()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMe, refreshPosts]);

  // Refetch /me on mount so followers/following/posts counts are always live
  useEffect(() => {
    if (isAuthenticated) refreshMe();
  }, [isAuthenticated, refreshMe]);

  // Pull-to-refresh: when at top of page and user pulls down, refresh profile + posts
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStart = (clientY: number) => {
      touchStartY.current = clientY;
      scrollStartY.current = typeof window !== 'undefined' ? window.scrollY : 0;
    };
    const handleMove = (clientY: number) => {
      if (scrollStartY.current > 8) return;
      const delta = clientY - touchStartY.current;
      if (delta > 0) {
        const damped = Math.min(delta * 0.5, PULL_MAX);
        currentPullY.current = damped;
        setPullY(damped);
      }
    };
    const handleEnd = () => {
      if (currentPullY.current >= PULL_THRESHOLD) {
        runRefresh();
      }
      currentPullY.current = 0;
      setPullY(0);
    };

    const onTouchStart = (e: TouchEvent) => handleStart(e.touches[0].clientY);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientY);
    const onTouchEnd = () => handleEnd();

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      handleStart(e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      handleMove(e.clientY);
    };
    const onPointerUp = () => handleEnd();

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isAuthenticated, runRefresh]);

  const dismissProfileCard = () => {
    setProfileCardDismissed(true);
    try { localStorage.setItem('profile_card_dismissed', 'true'); } catch { /* ignore */ }
  };

  const openConnections = useCallback(async (type: 'followers' | 'following') => {
    if (connectionsPanel === type) { setConnectionsPanel(null); return; }
    setConnectionsPanel(type);
    setConnectionsList([]);
    setConnectionsSearch('');
    setConnectionsLoading(true);
    try {
      const res = await fetch(`/api/me/connections?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setConnectionsList(data.users ?? []);
      }
    } catch { /* silently fail */ } finally {
      setConnectionsLoading(false);
    }
  }, [connectionsPanel]);

  const handleUnfollow = useCallback(async (targetId: string) => {
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unfollow', target_user_id: targetId }),
      });
      if (res.ok) {
        setConnectionsList((prev) => prev.filter((u) => u.id !== targetId));
        refreshMe();
      }
    } catch { /* silently fail */ }
  }, [refreshMe]);

  const filteredConnections = connectionsSearch.trim()
    ? connectionsList.filter(
        (u) =>
          u.displayName.toLowerCase().includes(connectionsSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(connectionsSearch.toLowerCase()),
      )
    : connectionsList;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  // Auth-aware profile data
  const displayName = user?.displayName || 'User';
  const username = user?.username ? `@${user.username}` : '@user';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';
  const userTopics = user?.onboarding?.topics ?? [];
  const userCountry = user?.onboarding?.country || '';
  const userAffiliation = user?.onboarding?.affiliation || '';

  // Real stats from server (default 0)
  const followersCount = stats?.followersCount ?? 0;
  const followingCount = stats?.followingCount ?? 0;
  const postsCount = stats?.postsCount ?? postCount;

  // Profile completion: show card only after the SERVER has responded with
  // authoritative profile data (stats is only set from server response).
  // This prevents flickering when localStorage cache doesn't have bio but
  // the server does — we wait for the server round-trip before showing.
  const serverHasResponded = !!stats;
  const showFinishProfile = !authLoading && serverHasResponded && !!profileCompletion && !profileCompletion.isComplete && !profileCardDismissed;

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 relative">
        {/* Pull-to-refresh indicator */}
        {(pullY > 0 || isRefreshing) && (
          <div
            className="absolute left-0 right-0 top-0 z-20 flex items-center justify-center overflow-hidden transition-colors duration-200"
            style={{ height: isRefreshing ? 56 : Math.min(pullY + 8, 56) }}
          >
            <div className="flex items-center gap-2 rounded-full bg-surface-elevated/95 px-4 py-2 shadow-lg border border-border-subtle">
              {isRefreshing ? (
                <>
                  <Loader2 className="w-5 h-5 text-civic-light animate-spin" />
                  <span className="text-sm font-medium text-text-primary">Updating profile…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 text-civic-light" />
                  <span className="text-sm font-medium text-text-secondary">
                    {pullY >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        <div className="max-w-2xl mx-auto">
          {/* Header banner */}
          <div className={clsx("h-32 relative overflow-hidden", user?.bannerUrl ? "bg-black" : "bg-gradient-to-r from-civic-dark via-civic to-civic-light")}>
            {user?.bannerUrl ? (
              <img src={user.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            )}
          </div>

          {/* Profile card */}
          <div className="px-4 sm:px-6 -mt-12 relative z-10">
            <div className="flex items-end gap-4 mb-4">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-24 h-24 rounded-2xl border-4 border-bg shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-surface-elevated border-4 border-bg flex items-center justify-center text-2xl font-bold text-civic-light shadow-lg">
                  {initials}
                </div>
              )}
              <div className="flex gap-2 mb-1">
                <Link
                  href="/settings"
                  className="px-4 py-1.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
                >
                  Edit Profile
                </Link>
                <Link href="/settings" className="p-1.5 bg-surface-elevated border border-border-subtle rounded-xl hover:bg-surface-hover transition-colors">
                  <Settings className="w-4 h-4 text-text-secondary" />
                </Link>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">{displayName}</h1>
                <CredibilityBadge score={stats?.credibilityScore ?? 50} size="md" showLabel showAlways />
              </div>
              <p className="text-sm text-text-muted">{username}</p>
            </div>

            {(user?.onboarding?.bio) && (
              <p className="text-sm text-text-secondary leading-relaxed mb-3">
                {user.onboarding.bio}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-text-muted mb-4 flex-wrap">
              {userCountry && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {userCountry}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {joinedDate}
              </span>
              {userAffiliation && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-civic-subtle text-civic-light">
                  {userAffiliation}
                </span>
              )}
            </div>

            {/* Stats — real values from server, 0 when new */}
            <div className="flex gap-6 mb-2 text-sm">
              <div>
                <span className="font-bold text-text-primary">{postsCount}</span>{' '}
                <span className="text-text-muted">Posts</span>
              </div>
              <button
                onClick={() => openConnections('following')}
                className={clsx(
                  'text-left transition-colors',
                  connectionsPanel === 'following' ? 'text-civic-light' : 'hover:text-text-primary',
                )}
              >
                <span className="font-bold text-text-primary">{followingCount}</span>{' '}
                <span className="text-text-muted">Following</span>
              </button>
              <button
                onClick={() => openConnections('followers')}
                className={clsx(
                  'text-left transition-colors',
                  connectionsPanel === 'followers' ? 'text-civic-light' : 'hover:text-text-primary',
                )}
              >
                <span className="font-bold text-text-primary">{followersCount}</span>{' '}
                <span className="text-text-muted">Followers</span>
              </button>
            </div>

            {/* Connections modal rendered via portal at end of component */}
          </div>

          {/* Complete your profile card — shows only when profile is incomplete */}
          {showFinishProfile && (
            <div className="mx-4 sm:mx-6 mb-4">
              <div className="bg-civic-subtle border border-civic/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-civic-muted flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-civic-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Complete your profile</p>
                  <p className="text-xs text-text-muted">
                    {profileCompletion!.missingFields.length > 0
                      ? `Missing: ${profileCompletion!.missingFields.join(', ')}`
                      : 'Add topics and preferences for a better feed experience.'}
                  </p>
                </div>
                <Link
                  href="/settings"
                  onClick={dismissProfileCard}
                  className="px-3 py-1.5 bg-civic text-white text-xs font-semibold rounded-xl hover:bg-civic-dark transition-colors shrink-0"
                >
                  Finish
                </Link>
                <button
                  onClick={dismissProfileCard}
                  className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors shrink-0 ml-1"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6">
            <div className="flex gap-0">
              {([
                { id: 'posts', label: `Posts${postsCount > 0 ? ` (${postsCount})` : ''}` },
                { id: 'overview', label: 'Overview' },
                { id: 'credibility', label: 'Credibility' },
                { id: 'debates', label: 'Debates' },
                { id: 'activity', label: 'Activity' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex-1 pb-3 pt-3 text-sm font-semibold text-center transition-colors border-b-2',
                    activeTab === tab.id
                      ? 'text-text-primary border-civic'
                      : 'text-text-muted border-transparent hover:text-text-secondary',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'posts' && <PostsTab posts={getPostsForProfile()} hydrated={hydrated} onDelete={removePost} />}
          {activeTab === 'overview' && <OverviewTab topics={userTopics} />}
          {activeTab === 'credibility' && <CredibilityTab score={stats?.credibilityScore ?? 50} />}
          {activeTab === 'debates' && <DebatesTab />}
          {activeTab === 'activity' && <ActivityTab />}

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    {/* Followers / Following modal portal */}
    {connectionsPanel && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConnectionsPanel(null)}>
        <div
          className="w-full max-w-md mx-4 bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with tabs */}
          <div className="border-b border-border-subtle">
            <div className="flex items-center justify-between px-4 pt-3 pb-0">
              <h2 className="text-base font-bold text-text-primary">{displayName}</h2>
              <button
                onClick={() => setConnectionsPanel(null)}
                className="p-1.5 -mr-1 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex mt-1">
              <button
                onClick={() => { if (connectionsPanel !== 'followers') openConnections('followers'); }}
                className={clsx(
                  'flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors',
                  connectionsPanel === 'followers'
                    ? 'border-civic-light text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover',
                )}
              >
                Followers
                <span className="ml-1.5 text-xs text-text-muted">{followersCount}</span>
              </button>
              <button
                onClick={() => { if (connectionsPanel !== 'following') openConnections('following'); }}
                className={clsx(
                  'flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors',
                  connectionsPanel === 'following'
                    ? 'border-civic-light text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary hover:bg-surface-hover',
                )}
              >
                Following
                <span className="ml-1.5 text-xs text-text-muted">{followingCount}</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 py-3 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search"
                value={connectionsSearch}
                onChange={(e) => setConnectionsSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-surface rounded-full border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic-light/50 focus:ring-1 focus:ring-civic-light/30 transition-colors"
              />
            </div>
          </div>

          {/* User list */}
          {connectionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-civic animate-spin" />
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">
                {connectionsSearch.trim()
                  ? 'No results found.'
                  : connectionsPanel === 'followers'
                    ? 'No followers yet.'
                    : 'Not following anyone yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle max-h-[60vh] overflow-y-auto">
              {filteredConnections.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
                >
                  <Link
                    href={`/profile/${u.username}`}
                    onClick={() => setConnectionsPanel(null)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-civic-muted flex items-center justify-center text-sm font-bold text-civic-light shrink-0">
                        {u.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{u.displayName}</p>
                      <p className="text-xs text-text-muted truncate">@{u.username}</p>
                    </div>
                  </Link>
                  {connectionsPanel === 'following' && (
                    <button
                      onClick={() => handleUnfollow(u.id)}
                      className="px-4 py-1.5 text-xs font-semibold rounded-full border border-border-subtle text-text-primary hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      Following
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body,
    )}
    </AuthGate>
  );
}

// ─── Posts Tab ───────────────────────────────────────────────

function PostsTab({ posts, hydrated, onDelete }: { posts: UserPost[]; hydrated: boolean; onDelete?: (postId: string) => void }) {
  if (!hydrated) {
    return (
      <div className="px-4 sm:px-6 py-16 text-center">
        <Loader2 className="w-6 h-6 text-civic animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Loading your posts...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-16 text-center">
        <PenLine className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-text-primary mb-1">No posts yet</h3>
        <p className="text-xs text-text-muted max-w-xs mx-auto">
          When you create posts, they will appear here on your profile for everyone to see.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle">
      {posts.map((post, i) => {
        const postData: PostData = {
          id: post.id,
          content: post.content,
          createdAt: post.createdAt,
          topics: post.topics,
          author: post.author,
          thread: post.thread,
          sources: post.sources,
          reactions: post.reactions,
          algorithm: post.algorithm,
          replies: post.replies as PostData['replies'],
          _optimistic: post._optimistic,
          _failed: post._failed,
        };
        return <PostCard key={post.id} post={postData} index={i} onDelete={onDelete} />;
      })}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────

function OverviewTab({ topics }: { topics: string[] }) {
  return (
    <>
      {/* Active Topics */}
      {topics.length > 0 && (
        <div className="px-4 sm:px-6 mt-6 mb-6">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">
              Active Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic: string) => (
                <Link
                  key={topic}
                  href={`/hashtag/${encodeURIComponent(topic)}`}
                  className="text-sm font-medium text-civic-light bg-civic-subtle px-3 py-1 rounded-full hover:bg-civic-muted transition-colors cursor-pointer"
                >
                  #{topic}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {topics.length === 0 && (
        <div className="px-4 sm:px-6 mt-6 mb-6">
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 text-center">
            <p className="text-sm text-text-muted">
              No topics selected yet. Update your interests in{' '}
              <Link href="/settings" className="text-civic-light hover:underline">Settings</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Privacy controls */}
      <div className="px-4 sm:px-6 mb-6">
        <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            Privacy & Data
          </h2>
          <div className="space-y-3">
            <PrivacyItem label="Show political affiliation on profile" enabled={true} />
            <PrivacyItem label="Anonymous browsing mode" enabled={false} />
            <PrivacyItem label="Allow engagement data for feed personalization" enabled={true} />
            <div className="pt-3 border-t border-border-subtle flex gap-3">
              <button className="text-xs text-info-light hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Export My Data
              </button>
              <button className="text-xs text-danger-light hover:underline">
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Credibility Tab ─────────────────────────────────────────

function CredibilityTab({ score }: { score: number }) {
  const isGold = score >= 95;
  const isGreen = score >= 90;
  const scoreColor = isGold ? 'text-amber-500' : isGreen ? 'text-emerald-500' : 'text-civic-light';
  const scoreBg = isGold ? 'bg-amber-500/15' : isGreen ? 'bg-emerald-500/15' : 'bg-civic-muted';
  const tierLabel = isGold ? 'Gold Tier' : isGreen ? 'Green Tier' : 'Neutral';

  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 text-center">
        <div className={`w-20 h-20 rounded-full ${scoreBg} flex items-center justify-center mx-auto mb-3`}>
          <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
        </div>
        <h2 className="text-lg font-bold text-text-primary">Your Credibility Score</h2>
        <p className="text-sm text-text-muted mt-1">
          {score <= 50
            ? 'Start engaging to build your credibility score.'
            : `${tierLabel} — ${score}% credibility earned through participation.`}
        </p>
        <Link
          href="/credibility"
          className="inline-flex items-center gap-1 text-xs text-civic-light mt-3 hover:underline"
        >
          <Info className="w-3 h-3" />
          How is this calculated?
        </Link>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-positive" />
          <h3 className="text-sm font-semibold text-text-primary">
            Improve Your Score
          </h3>
        </div>
        <div className="space-y-2">
          <ImprovementTip tip="Cite credible sources in your posts" impact="+2-5 points" />
          <ImprovementTip tip="Engage with opposing viewpoints respectfully" impact="+1-3 points" />
          <ImprovementTip tip="Maintain consistency over time" impact="+1-2 points" />
        </div>
      </div>
    </div>
  );
}

function ImprovementTip({ tip, impact }: { tip: string; impact: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border-subtle">
      <CheckCircle2 className="w-4 h-4 shrink-0 text-text-muted" />
      <div className="flex-1">
        <p className="text-sm text-text-secondary">{tip}</p>
      </div>
      <span className="text-xs font-medium text-positive-light bg-positive/10 px-2 py-0.5 rounded-full shrink-0">
        {impact}
      </span>
    </div>
  );
}

// ─── Debates Tab ─────────────────────────────────────────────

function DebatesTab() {
  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-civic-light" />
          <h2 className="text-sm font-semibold text-text-primary">
            Debate Summary
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-surface rounded-xl text-center">
            <p className="text-2xl font-bold text-text-primary">0</p>
            <p className="text-xs text-text-muted">Total Debates</p>
          </div>
          <div className="p-3 bg-surface rounded-xl text-center">
            <p className="text-2xl font-bold text-text-muted">—</p>
            <p className="text-xs text-text-muted">Avg Civility</p>
          </div>
          <div className="p-3 bg-surface rounded-xl text-center">
            <p className="text-2xl font-bold text-text-muted">0</p>
            <p className="text-xs text-text-muted">Common Ground</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-8 text-center">
        <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-text-primary mb-1">No debates yet</h3>
        <p className="text-xs text-text-muted max-w-xs mx-auto">
          Join a structured debate to see your history here.
        </p>
      </div>
    </div>
  );
}

// ─── Activity Tab ────────────────────────────────────────────

function ActivityTab() {
  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-civic-light" />
          <h2 className="text-sm font-semibold text-text-primary">
            Activity Breakdown
          </h2>
        </div>
        <div className="p-8 text-center">
          <BarChart3 className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">
            Start posting and engaging to see your activity breakdown here.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function PrivacyItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <div
        className={clsx(
          'w-10 h-5 rounded-full cursor-pointer transition-colors relative',
          enabled ? 'bg-civic' : 'bg-surface-active',
        )}
      >
        <div
          className={clsx(
            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-colors',
          )}
          style={{ left: enabled ? '22px' : '2px' }}
        />
      </div>
    </div>
  );
}
