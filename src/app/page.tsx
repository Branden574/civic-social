'use client';

import { useState } from 'react';
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
      <main className="flex-1 min-w-0 border-r border-border-subtle">
        <FeedView />
      </main>
      {/* Right panel — trending / suggested (desktop only) */}
      <aside className="hidden xl:block w-80 p-6 sticky top-0 h-screen overflow-y-auto">
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
  const trendingTopics = [
    { tag: 'healthcare', posts: '2.4k posts', trend: 'up' },
    { tag: 'infrastructure-bill', posts: '1.8k posts', trend: 'up' },
    { tag: 'climate-policy', posts: '1.2k posts', trend: 'up' },
    { tag: 'education-reform', posts: '890 posts', trend: 'stable' },
    { tag: 'criminal-justice', posts: '756 posts', trend: 'up' },
  ];

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
    <div className="space-y-6">
      {/* Trending */}
      <div className="bg-surface rounded-xl border border-border-subtle p-4">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
          Trending Topics
        </h3>
        <div className="space-y-3">
          {trendingTopics.map((topic) => (
            <a
              key={topic.tag}
              href={`/hashtag/${encodeURIComponent(topic.tag)}`}
              className="block group cursor-pointer"
            >
              <p className="text-sm font-medium text-text-primary group-hover:text-civic-light transition-colors">
                #{topic.tag}
              </p>
              <p className="text-xs text-text-muted">{topic.posts}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Suggested */}
      <div className="bg-surface rounded-xl border border-border-subtle p-4">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3">
          Suggested Voices
        </h3>
        <div className="space-y-3">
          {suggestedFollows.map((user) => (
            <div
              key={user.name}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-text-muted text-xs font-semibold border border-border-subtle">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate group-hover:text-civic-light transition-colors">
                  {user.name}
                </p>
                <p className="text-xs text-text-muted">{user.title}</p>
              </div>
              <span className="text-[10px] font-medium text-positive-light bg-positive/10 px-1.5 py-0.5 rounded-full">
                {user.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Platform info */}
      <div className="text-[11px] text-text-muted space-y-1 px-1">
        <p>Civic Social v0.2.0</p>
        <p>Civility-first ranking algorithm</p>
        <p className="text-text-muted/60">
          No rage amplification · No echo chambers · No ad tracking
        </p>
      </div>
    </div>
  );
}
