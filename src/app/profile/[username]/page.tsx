'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { useAuth } from '@/lib/auth-context';
import {
  Award,
  Shield,
  Heart,
  BookOpen,
  Scale,
  Target,
  TrendingUp,
  Calendar,
  MapPin,
  ArrowLeft,
  UserPlus,
  UserCheck,
  BadgeCheck,
  Bell,
  BellOff,
  BellRing,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Mock Public Profiles ─────────────────────────────────────

interface PublicProfile {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  country: string;
  joinedDate: string;
  affiliation: { label: string; ideology: string } | null;
  verificationLevel: string;
  credibilityScore: number;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  stats: { posts: number; threads: number; following: number; followers: number };
  reputation: {
    civility: number;
    accuracy: number;
    crossParty: number;
    solutionFocus: number;
    sourceQuality: number;
  };
  recentTopics: string[];
}

const mockProfiles: Record<string, PublicProfile> = {
  'sarah-chen': {
    id: 'user-sarah',
    displayName: 'Sarah Chen',
    username: '@sarahchen',
    bio: 'Policy analyst specializing in comparative healthcare systems. Believer in evidence-based policy and cross-party solutions.',
    country: 'United States',
    joinedDate: 'January 2025',
    affiliation: { label: 'Center-Left', ideology: 'center-left' },
    verificationLevel: 'EXPERT_VERIFIED',
    credibilityScore: 87,
    stats: { posts: 156, threads: 23, following: 89, followers: 1243 },
    reputation: { civility: 0.95, accuracy: 0.90, crossParty: 0.85, solutionFocus: 0.88, sourceQuality: 0.91 },
    recentTopics: ['healthcare', 'economy', 'education', 'climate', 'immigration'],
  },
  'marcus-johnson': {
    id: 'user-marcus',
    displayName: 'Marcus Johnson',
    username: '@marcusjohnson',
    bio: 'Small business owner and fiscal conservative. Interested in market-based solutions, EITC expansion, and practical economic policy.',
    country: 'United States',
    joinedDate: 'March 2025',
    affiliation: { label: 'Center-Right', ideology: 'center-right' },
    verificationLevel: 'CITIZEN_VERIFIED',
    credibilityScore: 74,
    stats: { posts: 89, threads: 12, following: 56, followers: 412 },
    reputation: { civility: 0.82, accuracy: 0.75, crossParty: 0.78, solutionFocus: 0.70, sourceQuality: 0.68 },
    recentTopics: ['economy', 'taxation', 'regulation', 'small-business'],
  },
  'elena-rodriguez': {
    id: 'user-elena',
    displayName: 'Dr. Elena Rodriguez',
    username: '@elenarodriguez',
    bio: 'Political scientist & fact-checker. I break down complex legislation into plain language. Non-partisan analysis only.',
    country: 'United States',
    joinedDate: 'December 2024',
    affiliation: { label: 'Center', ideology: 'center' },
    verificationLevel: 'EXPERT_VERIFIED',
    credibilityScore: 93,
    stats: { posts: 234, threads: 41, following: 120, followers: 3891 },
    reputation: { civility: 0.97, accuracy: 0.93, crossParty: 0.90, solutionFocus: 0.82, sourceQuality: 0.95 },
    recentTopics: ['infrastructure', 'legislation', 'education', 'fact-check'],
  },
  'amara-okafor': {
    id: 'user-amara',
    displayName: 'Amara Okafor',
    username: '@amaraokafor',
    bio: 'Environmental scientist focused on just transition. Bridging the gap between climate action and economic reality for working communities.',
    country: 'United States',
    joinedDate: 'February 2025',
    affiliation: { label: 'Left', ideology: 'left' },
    verificationLevel: 'EXPERT_VERIFIED',
    credibilityScore: 85,
    stats: { posts: 112, threads: 18, following: 73, followers: 1567 },
    reputation: { civility: 0.91, accuracy: 0.87, crossParty: 0.83, solutionFocus: 0.95, sourceQuality: 0.89 },
    recentTopics: ['climate', 'economy', 'energy', 'jobs', 'environment'],
  },
  'rachel-thompson': {
    id: 'user-rachel',
    displayName: 'Rachel Thompson',
    username: '@rachelthompson',
    bio: 'Army veteran and VA healthcare advocate. Believes in bipartisan solutions for veteran services. Former medic, current policy wonk.',
    country: 'United States',
    joinedDate: 'April 2025',
    affiliation: { label: 'Center-Right', ideology: 'center-right' },
    verificationLevel: 'CITIZEN_VERIFIED',
    credibilityScore: 79,
    stats: { posts: 67, threads: 8, following: 45, followers: 623 },
    reputation: { civility: 0.88, accuracy: 0.80, crossParty: 0.82, solutionFocus: 0.88, sourceQuality: 0.76 },
    recentTopics: ['veterans', 'healthcare', 'military', 'bipartisan'],
  },
  'david-park': {
    id: 'user-david',
    displayName: 'David Park',
    username: '@davidpark',
    bio: 'Tech policy researcher and privacy advocate. Focused on AI regulation, digital rights, and platform accountability.',
    country: 'United States',
    joinedDate: 'January 2025',
    affiliation: { label: 'Center', ideology: 'center' },
    verificationLevel: 'CITIZEN_VERIFIED',
    credibilityScore: 81,
    stats: { posts: 98, threads: 15, following: 67, followers: 892 },
    reputation: { civility: 0.89, accuracy: 0.84, crossParty: 0.86, solutionFocus: 0.80, sourceQuality: 0.82 },
    recentTopics: ['technology', 'privacy', 'ai', 'regulation'],
  },
  'james-obrien': {
    id: 'user-james',
    displayName: "James O'Brien",
    username: '@jamesobrien',
    bio: 'Second Amendment advocate and constitutional originalist. Small-town values, big-picture thinking. Veteran.',
    country: 'United States',
    joinedDate: 'February 2025',
    affiliation: { label: 'Right', ideology: 'right' },
    verificationLevel: 'CITIZEN_VERIFIED',
    credibilityScore: 62,
    stats: { posts: 73, threads: 5, following: 31, followers: 289 },
    reputation: { civility: 0.65, accuracy: 0.58, crossParty: 0.42, solutionFocus: 0.55, sourceQuality: 0.50 },
    recentTopics: ['gun-control', 'defense', 'constitution', 'veterans'],
  },
  'michael-adler': {
    id: 'user-michael',
    displayName: 'Prof. Michael Adler',
    username: '@michaeladler',
    bio: 'Professor of Constitutional Law at Georgetown. Published on separation of powers, judicial review, and democratic norms.',
    country: 'United States',
    joinedDate: 'November 2024',
    affiliation: { label: 'Center', ideology: 'center' },
    verificationLevel: 'EXPERT_VERIFIED',
    credibilityScore: 91,
    stats: { posts: 189, threads: 32, following: 95, followers: 4201 },
    reputation: { civility: 0.96, accuracy: 0.94, crossParty: 0.88, solutionFocus: 0.78, sourceQuality: 0.93 },
    recentTopics: ['legislation', 'constitution', 'supreme-court', 'elections'],
  },
};

// ─── Lookup helpers ──────────────────────────────────────────
// Build a reverse index: user-id → slug key, so profile links
// using post.author.id (like "user-sarah") resolve correctly.
const idToSlug: Record<string, string> = {};
for (const [slug, profile] of Object.entries(mockProfiles)) {
  idToSlug[profile.id] = slug;
}

/**
 * Resolve a URL parameter to a profile.
 * Accepts: slug ("sarah-chen"), user ID ("user-sarah"), or
 * the current user ID ("user-current") which redirects to /profile.
 */
function resolveProfile(param: string): PublicProfile | null {
  // Direct slug match (canonical)
  if (mockProfiles[param]) return mockProfiles[param];
  // User-ID match (from post.author.id links)
  const slug = idToSlug[param];
  if (slug && mockProfiles[slug]) return mockProfiles[slug];
  // Case-insensitive fallback
  const lower = param.toLowerCase();
  for (const [key, profile] of Object.entries(mockProfiles)) {
    if (key.toLowerCase() === lower) return profile;
    if (profile.id.toLowerCase() === lower) return profile;
  }
  return null;
}

// ─── Verification badge helpers ───────────────────────────────

function getVerificationBadge(level: string) {
  switch (level) {
    case 'EXPERT_VERIFIED':
      return { label: 'Expert Verified', icon: Award, color: 'text-positive' };
    case 'CITIZEN_VERIFIED':
      return { label: 'Citizen Verified', icon: BadgeCheck, color: 'text-civic-light' };
    default:
      return null;
  }
}

function getIdeologyColor(ideology: string) {
  const map: Record<string, string> = {
    left: 'bg-ideology-left/15 text-ideology-left',
    'center-left': 'bg-ideology-center-left/15 text-ideology-center-left',
    center: 'bg-ideology-center/15 text-ideology-center',
    'center-right': 'bg-ideology-center-right/15 text-ideology-center-right',
    right: 'bg-ideology-right/15 text-ideology-right',
  };
  return map[ideology] || 'bg-surface-active text-text-secondary';
}

// ─── Bell Dropdown ────────────────────────────────────────────

function BellDropdown({
  isNotifyEnabled,
  notifyLevel,
  onSubscribe,
  onUnsubscribe,
  isLoading,
}: {
  isNotifyEnabled: boolean;
  notifyLevel: string | null;
  onSubscribe: (level: 'all' | 'debates' | 'mentions') => void;
  onUnsubscribe: () => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const levels = [
    { value: 'all' as const, label: 'All posts', desc: 'Get notified for every new post' },
    { value: 'debates' as const, label: 'Debates & threads only', desc: 'Only structured debates and threads' },
    { value: 'mentions' as const, label: 'Mentions only', desc: 'Only when they mention you' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isLoading}
        className={clsx(
          'flex items-center gap-1 p-2 rounded-lg border transition-all duration-150',
          isNotifyEnabled
            ? 'border-civic/40 bg-civic/10 text-civic-light hover:bg-civic/20'
            : 'border-border-subtle bg-surface-elevated text-text-muted hover:bg-surface-hover hover:text-text-secondary',
        )}
        aria-label={isNotifyEnabled ? 'Notification preferences' : 'Enable post notifications'}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isNotifyEnabled ? (
          <BellRing className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-elevated border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-border-subtle">
            <p className="text-xs font-semibold text-text-primary">Post Notifications</p>
            <p className="text-[10px] text-text-muted mt-0.5">Choose what to be notified about</p>
          </div>
          {levels.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                onSubscribe(l.value);
                setOpen(false);
              }}
              className={clsx(
                'w-full text-left px-3 py-2.5 hover:bg-surface-hover transition-colors flex items-center gap-2',
                isNotifyEnabled && notifyLevel === l.value && 'bg-civic/5',
              )}
            >
              <div
                className={clsx(
                  'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                  isNotifyEnabled && notifyLevel === l.value
                    ? 'border-civic bg-civic'
                    : 'border-border-subtle',
                )}
              >
                {isNotifyEnabled && notifyLevel === l.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-text-primary">{l.label}</p>
                <p className="text-[10px] text-text-muted">{l.desc}</p>
              </div>
            </button>
          ))}
          {isNotifyEnabled && (
            <button
              onClick={() => {
                onUnsubscribe();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 border-t border-border-subtle hover:bg-danger/5 transition-colors flex items-center gap-2 text-danger-light"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Turn off notifications</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API user → PublicProfile adapter ────────────────────────

function apiUserToProfile(data: Record<string, unknown>): PublicProfile {
  const affLabel = (data.affiliation as string) || '';
  return {
    id: data.id as string,
    displayName: data.displayName as string,
    username: `@${data.username as string}`,
    bio: (data.bio as string) || '',
    country: 'United States',
    joinedDate: data.createdAt
      ? new Date(data.createdAt as string).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Recently',
    affiliation: affLabel ? { label: affLabel.charAt(0).toUpperCase() + affLabel.slice(1), ideology: affLabel } : null,
    verificationLevel: (data.verificationLevel as string) || 'EMAIL_VERIFIED',
    credibilityScore: (data.credibilityScore as number) ?? 50,
    avatarUrl: (data.avatarUrl as string) || null,
    bannerUrl: (data.bannerUrl as string) || null,
    stats: {
      posts: (data.postCount as number) ?? 0,
      threads: 0,
      following: (data.followingCount as number) ?? 0,
      followers: (data.followerCount as number) ?? 0,
    },
    reputation: {
      civility: 0.5,
      accuracy: 0.5,
      crossParty: 0.5,
      solutionFocus: 0.5,
      sourceQuality: 0.5,
    },
    recentTopics: [],
  };
}

// ─── Page ─────────────────────────────────────────────────────

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { refreshMe } = useAuth();
  const username = params.username as string;

  // Redirect "user-current" to the authenticated user's own profile page
  useEffect(() => {
    if (username === 'user-current') {
      router.replace('/profile');
    }
  }, [username, router]);

  // Resolve: accepts slug ("sarah-chen"), user ID ("user-sarah"), or mixed case
  const mockProfile = resolveProfile(username);

  // ── Dynamic profile state (for real users not in mock data) ─
  const [dynamicProfile, setDynamicProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(!mockProfile);
  const [profileNotFound, setProfileNotFound] = useState(false);

  // If no mock profile, fetch from API
  useEffect(() => {
    if (mockProfile || username === 'user-current') return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileNotFound(false);

    async function fetchProfile() {
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (cancelled) return;
        if (!res.ok) {
          setProfileNotFound(true);
          return;
        }
        const data = await res.json();
        setDynamicProfile(apiUserToProfile(data));
      } catch {
        if (!cancelled) setProfileNotFound(true);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    fetchProfile();
    return () => { cancelled = true; };
  }, [mockProfile, username]);

  // Unified profile: mock takes priority, then dynamic
  const profile: PublicProfile | null = mockProfile ?? dynamicProfile;

  // ── Social state (API-backed) ───────────────────────────
  const [isFollowing, setIsFollowing] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [notifyLevel, setNotifyLevel] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Sync followerCount when profile loads
  useEffect(() => {
    if (profile) setFollowerCount(profile.stats.followers);
  }, [profile]);

  // ── Toast state for error surfacing ─────────────────────
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch follow + subscription state on mount ──────────
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    async function fetchState() {
      try {
        const res = await fetch(`/api/follow?target=${encodeURIComponent(profile!.id)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setIsFollowing(data.isFollowing ?? false);
        setIsNotifyEnabled(data.isNotifyEnabled ?? false);
        setNotifyLevel(data.notifyLevel ?? null);
        // Use server follower count directly (includes mock + real edges)
        if (typeof data.followerCount === 'number') {
          setFollowerCount(data.followerCount);
        }
      } catch {
        // offline — keep defaults from profile.stats
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    fetchState();
    return () => { cancelled = true; };
  }, [profile]);

  // ── Follow / Unfollow ───────────────────────────────────
  const handleFollowToggle = useCallback(async () => {
    if (!profile || followLoading) return;
    const wasFollowing = isFollowing;
    const prevCount = followerCount;

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setFollowerCount(prevCount + (wasFollowing ? -1 : 1));
    if (wasFollowing) {
      setIsNotifyEnabled(false);
      setNotifyLevel(null);
    }
    setFollowLoading(true);

    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: wasFollowing ? 'unfollow' : 'follow',
          target_user_id: profile.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reconcile with server-authoritative state
        setIsFollowing(data.isFollowing);
        setIsNotifyEnabled(data.isNotifyEnabled ?? false);
        if (typeof data.followerCount === 'number') {
          setFollowerCount(data.followerCount);
        }
        refreshMe();
      } else if (res.status === 401) {
        // Not authenticated — rollback and show login prompt
        setIsFollowing(wasFollowing);
        setFollowerCount(prevCount);
        setToast('Please log in to follow users');
      } else {
        // Other server error — rollback
        setIsFollowing(wasFollowing);
        setFollowerCount(prevCount);
        const errData = await res.json().catch(() => null);
        setToast(errData?.error || 'Follow failed. Please try again.');
      }
    } catch {
      // Network error — rollback
      setIsFollowing(wasFollowing);
      setFollowerCount(prevCount);
      setToast('Network error. Please check your connection.');
    } finally {
      setFollowLoading(false);
    }
  }, [profile, isFollowing, followLoading, followerCount, refreshMe]);

  // ── Subscribe to posts ──────────────────────────────────
  const handleSubscribe = useCallback(async (level: 'all' | 'debates' | 'mentions') => {
    if (!profile) return;
    setBellLoading(true);
    setIsNotifyEnabled(true);
    setNotifyLevel(level);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          target_user_id: profile.id,
          level,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        setIsNotifyEnabled(data.isNotifyEnabled);
        setNotifyLevel(data.notifyLevel ?? level);
      }
    } catch {
      // keep optimistic
    } finally {
      setBellLoading(false);
    }
  }, [profile]);

  const handleUnsubscribe = useCallback(async () => {
    if (!profile) return;
    setBellLoading(true);
    setIsNotifyEnabled(false);
    setNotifyLevel(null);
    try {
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unsubscribe',
          target_user_id: profile.id,
        }),
      });
    } catch {
      // keep optimistic
    } finally {
      setBellLoading(false);
    }
  }, [profile]);

  // ── Loading state ────────────────────────────────────────
  if (profileLoading) {
    return (
      <AuthGate>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="text-center px-4 animate-fade-in">
            <Loader2 className="w-8 h-8 text-civic-light animate-spin mx-auto mb-4" />
            <p className="text-sm text-text-muted">Loading profile...</p>
          </div>
        </main>
        <MobileNav />
      </div>
      </AuthGate>
    );
  }

  // ── Not found ────────────────────────────────────────────
  if (!profile || profileNotFound) {
    return (
      <AuthGate>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="text-center px-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-text-muted" />
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">
              User not found
            </h1>
            <p className="text-sm text-text-muted mb-6 max-w-xs mx-auto">
              The profile you&apos;re looking for doesn&apos;t exist or may have been removed.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Feed
            </Link>
          </div>
        </main>
        <MobileNav />
      </div>
      </AuthGate>
    );
  }

  // ── Profile found ────────────────────────────────────────
  const badge = getVerificationBadge(profile.verificationLevel);
  const initials = profile.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          {/* Header banner */}
          <div className="h-32 bg-gradient-to-r from-civic-dark via-civic to-civic-light relative overflow-hidden">
            {profile.bannerUrl ? (
              <img src={profile.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            )}
          </div>

          {/* Profile card */}
          <div className="px-4 sm:px-6 -mt-12 relative z-10">
            {/* Avatar + action buttons */}
            <div className="flex items-end gap-4 mb-4">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-24 h-24 rounded-2xl border-4 border-bg shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-surface-elevated border-4 border-bg flex items-center justify-center text-2xl font-bold text-civic-light shadow-lg">
                  {initials}
                </div>
              )}
              <div className="flex gap-2 mb-1">
                {/* Follow / Following button */}
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading || !loaded}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all group',
                    isFollowing
                      ? 'bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-danger/5 hover:border-danger/30 hover:text-danger-light'
                      : 'bg-civic text-white hover:bg-civic-dark',
                    (followLoading || !loaded) && 'opacity-70',
                  )}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck className="w-4 h-4 group-hover:hidden" />
                      <span className="group-hover:hidden">Following</span>
                      <span className="hidden group-hover:inline">Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>

                {/* Bell dropdown (only shown if following) */}
                {isFollowing && (
                  <BellDropdown
                    isNotifyEnabled={isNotifyEnabled}
                    notifyLevel={notifyLevel}
                    onSubscribe={handleSubscribe}
                    onUnsubscribe={handleUnsubscribe}
                    isLoading={bellLoading}
                  />
                )}
              </div>
            </div>

            {/* Name + verification */}
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">
                  {profile.displayName}
                </h1>
                {badge && (
                  <badge.icon
                    className={clsx('w-5 h-5', badge.color)}
                    aria-label={badge.label}
                  />
                )}
              </div>
              <p className="text-sm text-text-muted">{profile.username}</p>
            </div>

            {/* Notification subscription badge */}
            {isNotifyEnabled && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-civic-light">
                <BellRing className="w-3.5 h-3.5" />
                <span>You&apos;ll be notified about {notifyLevel === 'all' ? 'all posts' : notifyLevel === 'debates' ? 'debates & threads' : 'mentions'}</span>
              </div>
            )}

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
                Joined {profile.joinedDate}
              </span>
              {profile.affiliation && (
                <span
                  className={clsx(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    getIdeologyColor(profile.affiliation.ideology),
                  )}
                >
                  {profile.affiliation.label}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-civic-light" />
                <span className="font-semibold text-civic-light">
                  {profile.credibilityScore}
                </span>{' '}
                Credibility
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mb-6 text-sm">
              <div>
                <span className="font-bold text-text-primary">
                  {profile.stats.posts}
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
                  {followerCount.toLocaleString()}
                </span>{' '}
                <span className="text-text-muted">Followers</span>
              </div>
            </div>
          </div>

          {/* ── Credibility Score Card ── */}
          <div className="px-4 sm:px-6 mb-6">
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-civic-light" />
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  Civic Reputation
                </h2>
                <span className="ml-auto text-lg font-bold text-positive-light">
                  {profile.credibilityScore}
                </span>
              </div>

              <div className="space-y-3">
                <RepBar label="Civility" value={profile.reputation.civility} color="bg-positive" icon={Heart} />
                <RepBar label="Source Quality" value={profile.reputation.sourceQuality} color="bg-info" icon={BookOpen} />
                <RepBar label="Accuracy" value={profile.reputation.accuracy} color="bg-warning" icon={Target} />
                <RepBar label="Solution Focus" value={profile.reputation.solutionFocus} color="bg-civic" icon={TrendingUp} />
                <RepBar label="Cross-Party" value={profile.reputation.crossParty} color="bg-civic-light" icon={Scale} />
              </div>
            </div>
          </div>

          {/* ── Active Topics ── */}
          <div className="px-4 sm:px-6 mb-6">
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
                Active Topics
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.recentTopics.map((topic) => (
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

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />

      {/* Toast for errors */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
          <div className="bg-surface-elevated border border-border-subtle text-text-primary text-sm font-medium px-4 py-3 rounded-xl shadow-xl max-w-xs text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
    </AuthGate>
  );
}

// ─── Sub-components ───────────────────────────────────────────

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
