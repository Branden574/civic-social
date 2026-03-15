'use client';

import { useState, useEffect } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { FeedView } from '@/components/feed/feed-view';
import { ComposeModal } from '@/components/compose/compose-modal';
import { LandingPage } from '@/components/landing/landing-page';
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
    return <LandingPage />;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar onCompose={() => setComposeOpen(true)} />
      <main id="main" className="flex-1 min-w-0 border-r border-border-subtle">
        <FeedView />
      </main>
      {/* Right panel — trending / suggested (desktop only) */}
      <aside className="hidden xl:block w-[300px] p-6 sticky top-0 h-screen overflow-y-auto">
        <TrendingPanel />
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

function TrendingPanel() {
  const defaultTopics = [
    { tag: 'healthcare', posts: '', trend: 'up' },
    { tag: 'infrastructure-bill', posts: '', trend: 'up' },
    { tag: 'climate-policy', posts: '', trend: 'up' },
    { tag: 'education-reform', posts: '', trend: 'stable' },
    { tag: 'criminal-justice', posts: '', trend: 'up' },
  ];
  const [trendingTopics, setTrendingTopics] = useState(defaultTopics);

  useEffect(() => {
    let cancelled = false;
    async function fetchCounts() {
      try {
        const results = await Promise.all(
          defaultTopics.map(async (t) => {
            try {
              const res = await fetch(`/api/hashtag/${encodeURIComponent(t.tag)}`);
              if (!res.ok) return { ...t, posts: '0 posts' };
              const data = await res.json();
              const count = (data.meta?.postCount ?? 0) + (data.meta?.newsCount ?? 0);
              return { ...t, posts: count === 1 ? '1 post' : `${count} posts` };
            } catch {
              return { ...t, posts: '0 posts' };
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

  const suggestedFollows = [
    {
      name: 'Dr. Elena Rodriguez',
      title: 'Political Scientist',
      badge: 'Expert',
    },
    {
      name: 'Marcus Johnson',
      title: 'Small Business Owner',
      badge: 'Citizen',
    },
    {
      name: 'Prof. Michael Adler',
      title: 'Constitutional Law',
      badge: 'Expert',
    },
  ];

  return (
    <div className="space-y-5 pt-4">
      {/* Trending */}
      <div className="bg-surface-elevated rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-text-muted mb-4">
          Trending Topics
        </h3>
        <div className="space-y-4">
          {trendingTopics.map((topic, i) => (
            <a
              key={topic.tag}
              href={`/hashtag/${encodeURIComponent(topic.tag)}`}
              className="flex items-start gap-3 group cursor-pointer"
            >
              <span className="text-xs text-text-muted font-medium mt-0.5 w-4">{i + 1}</span>
              <div>
                <p className="text-sm font-medium text-text-primary group-hover:text-text-secondary transition-colors">
                  #{topic.tag}
                </p>
                {topic.posts && <p className="text-xs text-text-muted mt-0.5">{topic.posts}</p>}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Suggested */}
      <div className="bg-surface-elevated rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-text-muted mb-4">
          Suggested Voices
        </h3>
        <div className="space-y-4">
          {suggestedFollows.map((user) => (
            <div
              key={user.name}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-text-secondary text-xs font-semibold">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.name}
                </p>
                <p className="text-xs text-text-muted">{user.title}</p>
              </div>
              <span className="text-xs font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded-full">
                {user.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Platform info */}
      <div className="text-xs text-text-muted space-y-1 px-2">
        <p>Civic Social v0.2.0</p>
        <p className="text-text-muted/50">
          No rage amplification · No echo chambers · No ad tracking
        </p>
      </div>
    </div>
  );
}
