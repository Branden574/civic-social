'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import {
  User,
  Award,
  Shield,
  TrendingUp,
  Heart,
  BookOpen,
  Scale,
  Target,
  Settings,
  Calendar,
  MapPin,
  ExternalLink,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Info,
  Users,
  Handshake,
  Lightbulb,
  BarChart3,
  CheckCircle2,
  PenLine,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { usePostStore, type UserPost } from '@/lib/post-store';
import { PostCard, type PostData } from '@/components/feed/post-card';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

// Mock current user profile (fallback data)
const profile = {
  displayName: 'Sarah Chen',
  username: '@sarahchen',
  bio: 'Policy analyst specializing in comparative healthcare systems. Believer in evidence-based policy and cross-party solutions.',
  country: 'United States',
  joinedDate: 'January 2025',
  verificationLevel: 'EXPERT_VERIFIED',
  affiliation: { label: 'Center-Left', ideology: 'center-left' },
  showAffiliation: true,
  stats: {
    posts: 156,
    threads: 23,
    following: 89,
    followers: 1243,
  },
  reputation: {
    overall: 0.92,
    civility: 0.95,
    accuracy: 0.90,
    crossParty: 0.85,
    solutionFocus: 0.88,
    sourceQuality: 0.91,
  },
  credibility: {
    score: 87,
    verifiedIdentity: 0.95,
    citationQuality: 0.88,
    civilEngagement: 0.93,
    reportAccuracy: 0.82,
    crossPartyEngagement: 0.85,
    behavioralConsistency: 0.90,
  },
  badges: [
    { label: 'Consistently Civil', icon: Heart, color: 'text-positive' },
    { label: 'Evidence-Rich', icon: BookOpen, color: 'text-info' },
    { label: 'Bridge Builder', icon: Scale, color: 'text-civic-light' },
    { label: 'Solution Seeker', icon: Target, color: 'text-warning' },
  ],
  recentTopics: ['healthcare', 'economy', 'education', 'climate', 'immigration'],
  debateHistory: [
    { id: '1', title: 'Universal Healthcare vs. Market-Based Reform', date: '2 days ago', outcome: 'Constructive', participants: 12, yourCivility: 0.96 },
    { id: '2', title: 'Carbon Tax Implementation Strategy', date: '1 week ago', outcome: 'Common Ground Found', participants: 8, yourCivility: 0.93 },
    { id: '3', title: 'Immigration Policy: Border Security vs. Pathway', date: '2 weeks ago', outcome: 'Ongoing', participants: 24, yourCivility: 0.91 },
    { id: '4', title: 'Education Funding: Federal vs. State Control', date: '3 weeks ago', outcome: 'Resolved', participants: 6, yourCivility: 0.98 },
  ],
  commonGround: {
    participations: 18,
    insightsGenerated: 7,
    bridgesBuilt: 12,
    crossPartyAgreements: 9,
  },
  activityBreakdown: {
    posts: 156,
    replies: 342,
    newsComments: 45,
    policyProposals: 8,
    proposalsSupported: 23,
    debatesJoined: 31,
  },
};

type ProfileTab = 'posts' | 'overview' | 'debates' | 'activity' | 'credibility';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const { getPostsForProfile, postCount, hydrated } = usePostStore();
  const { user, isAuthenticated, isNewUser } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated — must be in useEffect to avoid
  // updating Router state during ProfilePage render (React anti-pattern).
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Auth-aware profile data (overlays real user data on mock)
  const displayName = user?.displayName || profile.displayName;
  const username = user?.username ? `@${user.username}` : profile.username;
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : profile.joinedDate;
  const onboardingDone = !!user?.onboarding?.completedAt;
  const userTopics = user?.onboarding?.topics || profile.recentTopics;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          {/* Header banner */}
          <div className="h-32 bg-gradient-to-r from-civic-dark via-civic to-civic-light relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
          </div>

          {/* Profile card — avatar overlaps banner with -mt-12 */}
          <div className="px-4 sm:px-6 -mt-12 relative z-10">
            {/* Avatar + actions */}
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

            {/* Name + verification */}
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">
                  {displayName}
                </h1>
                <Award className="w-5 h-5 text-positive" aria-label="Expert Verified" />
              </div>
              <p className="text-sm text-text-muted">{username}</p>
            </div>

            {/* Bio */}
            <p className="text-sm text-text-secondary leading-relaxed mb-3">
              {profile.bio}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-text-muted mb-4 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.country}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {joinedDate}
              </span>
              {profile.showAffiliation && (
                <span
                  className={clsx(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    'bg-ideology-center-left/15 text-ideology-center-left',
                  )}
                >
                  {profile.affiliation.label}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-civic-light" />
                <span className="font-semibold text-civic-light">{profile.credibility.score}</span> Credibility
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mb-4 text-sm">
              <div>
                <span className="font-bold text-text-primary">
                  {postCount > 0 ? postCount : profile.stats.posts}
                </span>{' '}
                <span className="text-text-muted">Posts</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">
                  {profile.stats.threads}
                </span>{' '}
                <span className="text-text-muted">Threads</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">
                  {profile.stats.following}
                </span>{' '}
                <span className="text-text-muted">Following</span>
              </div>
              <div>
                <span className="font-bold text-text-primary">
                  {profile.stats.followers.toLocaleString()}
                </span>{' '}
                <span className="text-text-muted">Followers</span>
              </div>
            </div>
          </div>

          {/* Complete your profile card — positioned AFTER profile card, no overlap */}
          {isNewUser && !onboardingDone && (
            <div className="mx-4 sm:mx-6 mb-4">
              <div className="bg-civic/5 border border-civic/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-civic/15 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-civic-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Complete your profile</p>
                  <p className="text-xs text-text-muted">Add topics and preferences for a better feed experience.</p>
                </div>
                <Link
                  href="/settings"
                  className="px-3 py-1.5 bg-civic text-white text-xs font-semibold rounded-lg hover:bg-civic-dark transition-colors shrink-0"
                >
                  Finish
                </Link>
              </div>
            </div>
          )}

          {/* ── Profile Tab Switcher ── */}
          <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6">
            <div className="flex gap-0">
              {([
                { id: 'posts', label: `Posts${postCount > 0 ? ` (${postCount})` : ''}` },
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

          {/* ── Tab Content ── */}
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
  );
}

// ─── Posts Tab ───────────────────────────────────────────────

function PostsTab({ posts, hydrated }: { posts: UserPost[]; hydrated: boolean }) {
  // Show loading spinner while hydrating from server
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
        <h3 className="text-sm font-semibold text-text-primary mb-1">
          No posts yet
        </h3>
        <p className="text-xs text-text-muted max-w-xs mx-auto">
          When you create posts, they will appear here on your profile for
          everyone to see.
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
      {/* Civic Reputation Card */}
      <div className="px-4 sm:px-6 mt-6 mb-6">
        <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-civic-light" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Civic Reputation
            </h2>
            <span className="ml-auto text-lg font-bold text-positive-light">
              {Math.round(profile.reputation.overall * 100)}
            </span>
          </div>

          <div className="space-y-3">
            <RepBar label="Civility" value={profile.reputation.civility} color="bg-positive" icon={Heart} />
            <RepBar label="Source Quality" value={profile.reputation.sourceQuality} color="bg-info" icon={BookOpen} />
            <RepBar label="Accuracy" value={profile.reputation.accuracy} color="bg-warning" icon={Target} />
            <RepBar label="Solution Focus" value={profile.reputation.solutionFocus} color="bg-civic" icon={TrendingUp} />
            <RepBar label="Cross-Party" value={profile.reputation.crossParty} color="bg-civic-light" icon={Scale} />
          </div>

          <div className="mt-5 pt-4 border-t border-border-subtle">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Earned Badges
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map((badge) => (
                <span
                  key={badge.label}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary bg-surface px-2.5 py-1 rounded-lg border border-border-subtle"
                >
                  <badge.icon className={clsx('w-3.5 h-3.5', badge.color)} />
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Common Ground Metrics */}
      <div className="px-4 sm:px-6 mb-6">
        <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
          <div className="flex items-center gap-2 mb-4">
            <Handshake className="w-5 h-5 text-positive" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Common Ground Participation
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox label="Participations" value={profile.commonGround.participations} icon={Users} color="text-civic-light" />
            <MetricBox label="Insights Generated" value={profile.commonGround.insightsGenerated} icon={Lightbulb} color="text-warning-light" />
            <MetricBox label="Bridges Built" value={profile.commonGround.bridgesBuilt} icon={Scale} color="text-positive-light" />
            <MetricBox label="Cross-Party Agreements" value={profile.commonGround.crossPartyAgreements} icon={Handshake} color="text-info-light" />
          </div>
        </div>
      </div>

      {/* Active Topics */}
      <div className="px-4 sm:px-6 mb-6">
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
  const cred = profile.credibility;
  const factors = [
    { label: 'Verified Identity', value: cred.verifiedIdentity, weight: '10%', color: 'bg-positive', description: 'Optional but rewarded verification status' },
    { label: 'Citation Quality', value: cred.citationQuality, weight: '25%', color: 'bg-info', description: 'Usage of credible, primary sources' },
    { label: 'Civil Engagement', value: cred.civilEngagement, weight: '25%', color: 'bg-civic', description: 'Constructive tone and respectful discourse' },
    { label: 'Report Accuracy', value: cred.reportAccuracy, weight: '15%', color: 'bg-warning', description: 'Fair and accurate content reports' },
    { label: 'Cross-Party Engagement', value: cred.crossPartyEngagement, weight: '15%', color: 'bg-civic-light', description: 'Engaging across political perspectives' },
    { label: 'Behavioral Consistency', value: cred.behavioralConsistency, weight: '10%', color: 'bg-positive-light', description: 'Steady, non-manipulative patterns' },
  ];

  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      {/* Score Header */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-civic/15 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-bold text-civic-light">{cred.score}</span>
        </div>
        <h2 className="text-lg font-bold text-text-primary">Your Credibility Score</h2>
        <p className="text-sm text-text-muted mt-1">
          Transparent, non-partisan, and resistant to manipulation
        </p>
        <Link
          href="/credibility"
          className="inline-flex items-center gap-1 text-xs text-civic-light mt-3 hover:underline"
        >
          <Info className="w-3 h-3" />
          How is this calculated?
        </Link>
      </div>

      {/* Factor Breakdown */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
          Score Breakdown
        </h3>
        <div className="space-y-4">
          {factors.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">{f.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted font-medium">{f.weight}</span>
                  <span className="text-sm font-mono font-bold text-text-primary">
                    {Math.round(f.value * 100)}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-700', f.color)}
                  style={{ width: `${Math.round(f.value * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Tips */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-positive" />
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Improve Your Score
          </h3>
        </div>
        <div className="space-y-2">
          <ImprovementTip
            tip="Cite credible sources in your posts"
            impact="+2-5 points"
            current={cred.citationQuality}
          />
          <ImprovementTip
            tip="Engage with opposing viewpoints respectfully"
            impact="+1-3 points"
            current={cred.crossPartyEngagement}
          />
          <ImprovementTip
            tip="Maintain consistency over time"
            impact="+1-2 points"
            current={cred.behavioralConsistency}
          />
        </div>
      </div>
    </div>
  );
}

function ImprovementTip({ tip, impact, current }: { tip: string; impact: string; current: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border-subtle">
      <CheckCircle2 className={clsx('w-4 h-4 shrink-0', current >= 0.9 ? 'text-positive' : 'text-text-muted')} />
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
      {/* Summary */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-civic-light" />
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Debate Summary
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-text-primary">{profile.debateHistory.length}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Debates</p>
          </div>
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-positive-light">95%</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg Civility</p>
          </div>
          <div className="p-3 bg-surface rounded-lg text-center">
            <p className="text-2xl font-bold text-civic-light">2</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Common Ground</p>
          </div>
        </div>
      </div>

      {/* Debate History */}
      <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Debate History
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {profile.debateHistory.map((debate) => (
            <div key={debate.id} className="px-5 py-4 hover:bg-surface/40 transition-colors cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-text-primary truncate">
                    {debate.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                    <span>{debate.date}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {debate.participants}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={clsx(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    debate.outcome === 'Common Ground Found'
                      ? 'bg-positive/10 text-positive-light'
                      : debate.outcome === 'Constructive'
                        ? 'bg-civic/10 text-civic-light'
                        : debate.outcome === 'Ongoing'
                          ? 'bg-warning/10 text-warning-light'
                          : 'bg-surface-active text-text-secondary',
                  )}>
                    {debate.outcome}
                  </span>
                  <span className={clsx(
                    'text-[10px] font-mono px-1.5 py-0.5 rounded',
                    debate.yourCivility >= 0.9 ? 'bg-positive/10 text-positive-light' : 'bg-warning/10 text-warning-light',
                  )}>
                    {Math.round(debate.yourCivility * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Activity Tab ────────────────────────────────────────────

function ActivityTab() {
  const a = profile.activityBreakdown;
  const items = [
    { label: 'Posts', count: a.posts, icon: MessageSquare, color: 'text-civic-light' },
    { label: 'Replies', count: a.replies, icon: MessageSquare, color: 'text-text-secondary' },
    { label: 'News Comments', count: a.newsComments, icon: BookOpen, color: 'text-info-light' },
    { label: 'Policy Proposals Created', count: a.policyProposals, icon: Target, color: 'text-warning-light' },
    { label: 'Proposals Supported', count: a.proposalsSupported, icon: Heart, color: 'text-positive-light' },
    { label: 'Debates Joined', count: a.debatesJoined, icon: Scale, color: 'text-civic-light' },
  ];

  return (
    <div className="px-4 sm:px-6 mt-6 space-y-6">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-civic-light" />
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Activity Breakdown
          </h2>
        </div>
        <div className="space-y-3">
          {items.map((item) => {
            const maxCount = Math.max(...items.map((i) => i.count));
            return (
              <div key={item.label} className="flex items-center gap-3">
                <item.icon className={clsx('w-4 h-4 shrink-0', item.color)} />
                <span className="text-sm text-text-secondary w-48 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-civic transition-all duration-700"
                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold text-text-primary w-10 text-right">
                  {item.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MetricBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="p-3 bg-surface rounded-lg text-center">
      <Icon className={clsx('w-5 h-5 mx-auto mb-1', color)} />
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
    </div>
  );
}

function RepBar({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: typeof Heart;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-text-muted shrink-0" />
      <span className="text-xs text-text-secondary w-36 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-text-secondary w-10 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

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
