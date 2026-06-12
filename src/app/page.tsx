'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, TrendingUp, BadgeCheck, ShieldCheck } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { FeedView } from '@/components/feed/feed-view';
import { ComposeModal } from '@/components/compose/compose-modal';
import { CivicLanding } from '@/components/landing/civic-landing';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { isAuthenticated, isLoading, refreshMe } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);

  // Wait for auth state to hydrate before deciding which view to show
  if (isLoading) {
    return null;
  }

  // Logged-out users see the premium landing page
  if (!isAuthenticated) {
    return <CivicLanding />;
  }

  return (
    <div className="flex justify-center min-h-screen bg-bg">
      <Sidebar onCompose={() => setComposeOpen(true)} />
      <main
        id="main"
        className="flex-1 min-w-0 max-w-[600px] border-x border-border-hairline"
      >
        <FeedView />
      </main>
      {/* Right discovery panel (xl+ only) */}
      <aside className="hidden xl:flex flex-col gap-3.5 w-[340px] shrink-0 px-[18px] pt-3.5 pb-6 sticky top-0 h-screen overflow-y-auto">
        <DiscoveryPanel />
      </aside>
      <MobileNav onCompose={() => setComposeOpen(true)} />
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPostCreated={() => {
          refreshMe();
        }}
      />
    </div>
  );
}

// ─── Right discovery panel ───────────────────────────────────

interface TopicRow {
  tag: string;
  posts: string;
  note: string;
}

function DiscoveryPanel() {
  const defaultTopics: TopicRow[] = [
    { tag: 'healthcare', posts: '', note: 'Senate vote today' },
    { tag: 'infrastructure-bill', posts: '', note: 'CBO score released' },
    { tag: 'climate-policy', posts: '', note: 'Passed 3 committees' },
    { tag: 'education-reform', posts: '', note: 'Cross-party thread' },
    { tag: 'criminal-justice', posts: '', note: 'New hearing scheduled' },
  ];
  const [trendingTopics, setTrendingTopics] = useState<TopicRow[]>(defaultTopics);

  useEffect(() => {
    let cancelled = false;
    async function fetchCounts() {
      try {
        const results = await Promise.all(
          defaultTopics.map(async (t) => {
            try {
              const res = await fetch(`/api/hashtag/${encodeURIComponent(t.tag)}`);
              if (!res.ok) return { ...t, posts: '0' };
              const data = await res.json();
              const count = (data.meta?.postCount ?? 0) + (data.meta?.newsCount ?? 0);
              return { ...t, posts: count.toLocaleString() };
            } catch {
              return { ...t, posts: '0' };
            }
          }),
        );
        if (!cancelled) setTrendingTopics(results);
      } catch { /* keep defaults */ }
    }
    fetchCounts();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trending legislation — restyled from existing static data (no new API route).
  const bills = [
    {
      code: 'H.R. 2847',
      status: 'Floor vote',
      statusClass: 'bg-positive-light/[0.12] text-positive-light',
      title: 'Interstate Grid Permitting Reform Act',
      done: 3,
    },
    {
      code: 'S. 1129',
      status: 'In committee',
      statusClass: 'bg-warning-light/[0.12] text-warning-light',
      title: 'Working Families Childcare Credit Act',
      done: 2,
    },
  ];

  const voices = [
    { initials: 'AK', name: 'Amara Khan', role: 'Election law · UCLA', avClass: 'bg-info-light/[0.14] text-info-light' },
    { initials: 'TR', name: 'Tom Reyes', role: 'Fmr. city budget director', avClass: 'bg-[#FB923C]/[0.14] text-[#FB923C]' },
    { initials: 'LP', name: 'Lena Park', role: 'Housing economist', avClass: 'bg-positive-light/[0.14] text-positive-light' },
  ];
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  return (
    <>
      {/* Search */}
      <Link
        href="/search"
        className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface border border-border-subtle rounded-xl text-text-muted hover:border-border transition-colors"
        aria-label="Search topics, bills, voices"
      >
        <Search className="w-[15px] h-[15px] shrink-0" />
        <span className="text-[13.5px]">Search topics, bills, voices</span>
      </Link>

      {/* Live civic pulse */}
      <section className="px-4 py-3.5 bg-surface border border-border-subtle rounded-2xl">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-danger-light animate-pulse-dot" aria-hidden="true" />
          <span className="text-[12.5px] font-bold text-text-primary">Live civic pulse</span>
          <span className="ml-auto text-[11px] font-mono text-text-muted">12.4k watching</span>
        </div>
        <p className="text-[13.5px] font-semibold leading-snug text-text-primary">
          Senate floor: grid-permitting package heads to final vote
        </p>
        <p className="text-xs text-text-muted mt-1">Live room · 312 in discussion · civility 93%</p>
        <Link
          href="/debates"
          className="inline-flex items-center gap-1.5 mt-[11px] px-3.5 py-2 bg-transparent border border-border rounded-full text-xs font-semibold text-civic-light hover:bg-civic-subtle hover:border-civic transition-colors"
        >
          Join live room
          <ArrowRight className="w-3 h-3" />
        </Link>
      </section>

      {/* Trending in civics */}
      <section className="py-1.5 bg-surface border border-border-subtle rounded-2xl">
        <h3 className="px-4 pt-1.5 pb-1.5 text-[13px] font-bold text-text-primary">Trending in civics</h3>
        {trendingTopics.map((topic) => (
          <Link
            key={topic.tag}
            href={`/hashtag/${encodeURIComponent(topic.tag)}`}
            className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-hover transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-text-primary truncate">#{topic.tag}</p>
              <p className="text-[11.5px] text-text-muted mt-px truncate">
                {topic.posts ? `${topic.posts} posts · ` : ''}{topic.note}
              </p>
            </div>
            <TrendingUp className="w-3.5 h-3.5 text-positive-light shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </section>

      {/* Trending legislation */}
      <section className="py-1.5 bg-surface border border-border-subtle rounded-2xl">
        <h3 className="px-4 pt-1.5 pb-1.5 text-[13px] font-bold text-text-primary">Trending legislation</h3>
        {bills.map((b) => (
          <Link
            key={b.code}
            href="/labs"
            className="block px-4 py-2.5 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold font-mono text-civic-light">{b.code}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.statusClass}`}>
                {b.status}
              </span>
            </div>
            <p className="text-[13px] font-medium leading-snug text-text-primary mt-[3px]">{b.title}</p>
            <div className="flex gap-[3px] mt-[7px]" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`flex-1 h-[3px] rounded-full ${i < b.done ? 'bg-civic' : 'bg-surface-active'}`}
                />
              ))}
            </div>
          </Link>
        ))}
        <div className="h-2" />
      </section>

      {/* Suggested voices */}
      <section className="py-1.5 bg-surface border border-border-subtle rounded-2xl">
        <h3 className="px-4 pt-1.5 pb-1.5 text-[13px] font-bold text-text-primary">Suggested voices</h3>
        {voices.map((v) => {
          const on = !!following[v.name];
          return (
            <div key={v.name} className="flex items-center gap-2.5 px-4 py-2.5">
              <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-[12.5px] font-bold shrink-0 ${v.avClass}`}>
                {v.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-text-primary truncate">{v.name}</span>
                  <BadgeCheck className="w-[13px] h-[13px] text-civic shrink-0" aria-label="Verified" />
                </div>
                <p className="text-[11.5px] text-text-muted truncate">{v.role}</p>
              </div>
              <button
                onClick={() => setFollowing((prev) => ({ ...prev, [v.name]: !prev[v.name] }))}
                aria-pressed={on}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  on
                    ? 'bg-transparent text-text-secondary border-border'
                    : 'bg-text-primary text-bg border-text-primary hover:brightness-95'
                }`}
              >
                {on ? 'Following' : 'Follow'}
              </button>
            </div>
          );
        })}
        <div className="h-2" />
      </section>

      {/* Trust promise footer */}
      <div className="px-1.5">
        <div className="flex items-start gap-2 px-3 py-3 border border-border-subtle rounded-2xl">
          <ShieldCheck className="w-3.5 h-3.5 text-civic-light shrink-0 mt-px" aria-hidden="true" />
          <p className="text-[11.5px] leading-relaxed text-text-muted">
            No engagement bait. Ranking favors sources, civility, and viewpoint diversity — and you can always see why.{' '}
            <Link href="/how-it-works" className="text-civic-light hover:underline">How ranking works</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 px-3 pt-3 text-[11px] text-text-muted">
          <Link href="/how-it-works" className="hover:text-text-secondary transition-colors">About</Link>
          <Link href="/safety" className="hover:text-text-secondary transition-colors">Moderation policy</Link>
          <Link href="/appeals" className="hover:text-text-secondary transition-colors">Appeals</Link>
          <Link href="/settings" className="hover:text-text-secondary transition-colors">Privacy</Link>
          <span>© 2026 Civic Social</span>
        </div>
      </div>
    </>
  );
}
