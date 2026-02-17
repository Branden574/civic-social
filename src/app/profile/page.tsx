'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import clsx from 'clsx';
import { usePostStore, type UserPost } from '@/lib/post-store';
import { PostCard, type PostData } from '@/components/feed/post-card';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { CredibilityBadge } from '@/components/ui/credibility-badge';
import { AuthGate } from '@/components/auth/auth-gate';

type ProfileTab = 'posts' | 'overview' | 'debates' | 'activity' | 'credibility';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [profileCardDismissed, setProfileCardDismissed] = useState(false);
  const { getPostsForProfile, postCount, hydrated } = usePostStore();
  const { user, isAuthenticated, onboardingDone, profileCompletion, stats, refreshMe } = useAuth();
  const router = useRouter();

  // Refetch /me on mount so followers/following/posts counts are always live
  useEffect(() => {
    if (isAuthenticated) refreshMe();
  }, [isAuthenticated, refreshMe]);

  // Load dismiss state from localStorage
  useEffect(() => {
    try {
      if (localStorage.getItem('profile_card_dismissed') === 'true') {
        setProfileCardDismissed(true);
      }
    } catch { /* SSR or private browsing */ }
  }, []);

  const dismissProfileCard = () => {
    setProfileCardDismissed(true);
    try { localStorage.setItem('profile_card_dismissed', 'true'); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
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

  // Profile completion: show card only if NOT complete, NOT dismissed
  const showFinishProfile = !!profileCompletion && !profileCompletion.isComplete && !onboardingDone && !profileCardDismissed;

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          {/* Header banner */}
          <div className="h-32 bg-gradient-to-r from-civic-dark via-civic to-civic-light relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
          </div>

          {/* Profile card */}
          <div className="px-4 sm:px-6 -mt-12 relative z-10">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-24 h-24 rounded-2xl bg-surface-elevated border-4 border-bg flex items-center justify-center text-2xl font-bold text-civic-light shadow-lg">
                {initials}
              </div>
              <div className="flex gap-2 mb-1">
                <Link
                  href="/settings"
                  className="px-4 py-1.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
                >
                  Edit Profile
                </Link>
                <Link href="/settings" className="p-1.5 bg-surface-elevated border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors">
                  <Settings className="w-4 h-4 text-text-secondary" />
                </Link>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">{displayName}</h1>
                <CredibilityBadge score={90} size="md" showLabel />
              </div>
              <p className="text-sm text-text-muted">{username}</p>
            </div>

            {userCountry && (
              <p className="text-sm text-text-secondary leading-relaxed mb-3">
                {user?.onboarding?.bio || ''}
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
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-civic/10 text-civic-light">
                  {userAffiliation}
                </span>
              )}
            </div>

            {/* Stats — real values from server, 0 when new */}
            <div className="flex gap-6 mb-4 text-sm">
              <div>
                <span className="font-bold text-text-primary">{postsCount}</span>{' '}
                <span className="text-text-muted">Posts</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">{followingCount}</span>{' '}
                <span className="text-text-muted">Following</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">{followersCount}</span>{' '}
                <span className="text-text-muted">Followers</span>
              </div>
            </div>
          </div>

          {/* Complete your profile card — shows only when profile is incomplete */}
          {showFinishProfile && (
            <div className="mx-4 sm:mx-6 mb-4">
              <div className="bg-civic/5 border border-civic/20 rounded-xl p-4 flex items-center gap-3 relative">
                <button
                  onClick={dismissProfileCard}
                  className="absolute top-2 right-2 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-civic/15 flex items-center justify-center shrink-0">
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
                  className="px-3 py-1.5 bg-civic text-white text-xs font-semibold rounded-lg hover:bg-civic-dark transition-colors shrink-0"
                >
                  Finish
                </Link>
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
          {activeTab === 'posts' && <PostsTab posts={getPostsForProfile()} hydrated={hydrated} />}
          {activeTab === 'overview' && <OverviewTab topics={userTopics} />}
          {activeTab === 'credibility' && <CredibilityTab />}
          {activeTab === 'debates' && <DebatesTab />}
          {activeTab === 'activity' && <ActivityTab />}

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}

// ─── Posts Tab ───────────────────────────────────────────────

function PostsTab({ posts, hydrated }: { posts: UserPost[]; hydrated: boolean }) {
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
        return <PostCard key={post.id} post={postData} index={i} />;
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
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
              Active Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic: string) => (
                <Link
                  key={topic}
                  href={`/hashtag/${encodeURIComponent(topic)}`}
                  className="text-sm font-medium text-civic-light bg-civic/8 px-3 py-1 rounded-full hover:bg-civic/15 transition-colors cursor-pointer"
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
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
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

function CredibilityTab() {
  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-civic/15 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-bold text-civic-light">0</span>
        </div>
        <h2 className="text-lg font-bold text-text-primary">Your Credibility Score</h2>
        <p className="text-sm text-text-muted mt-1">
          Start engaging to build your credibility score.
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
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
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
    <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle">
      <CheckCircle2 className="w-4 h-4 shrink-0 text-text-muted" />
      <div className="flex-1">
        <p className="text-sm text-text-secondary">{tip}</p>
      </div>
      <span className="text-[10px] font-medium text-positive-light bg-positive/10 px-2 py-0.5 rounded-full shrink-0">
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
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Debate Summary
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-text-primary">0</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Debates</p>
          </div>
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-text-muted">—</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg Civility</p>
          </div>
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-text-muted">0</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Common Ground</p>
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
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
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
            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
          )}
          style={{ left: enabled ? '22px' : '2px' }}
        />
      </div>
    </div>
  );
}
