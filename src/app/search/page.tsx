'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { PostCard, type PostData } from '@/components/feed/post-card';
import Link from 'next/link';
import {
  Search,
  X,
  Users,
  Newspaper,
  MessageSquare,
  TrendingUp,
  Hash,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Constants ──────────────────────────────────────────────

const TOPIC_CHIPS = [
  'healthcare',
  'economy',
  'climate',
  'education',
  'immigration',
  'criminal-justice',
  'technology',
  'defense',
  'infrastructure',
  'housing',
  'elections',
  'foreign-policy',
  'civil-rights',
  'taxation',
] as const;

type FilterTab = 'all' | 'posts' | 'people' | 'news' | 'debates';

const FILTER_TABS: { id: FilterTab; label: string; icon: typeof Search }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'posts', label: 'Posts', icon: Hash },
  { id: 'people', label: 'People', icon: Users },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'debates', label: 'Debates', icon: MessageSquare },
];

// ─── Mock People Data ───────────────────────────────────────

interface MockPerson {
  id: string;
  name: string;
  handle: string;
  bio: string;
  affiliation: string;
  credibility: number;
  followers: number;
  verified: boolean;
}

const MOCK_PEOPLE: MockPerson[] = [
  {
    id: 'p1',
    name: 'Dr. Elena Vasquez',
    handle: '@evasquez',
    bio: 'Health policy researcher at Johns Hopkins. Focus on equitable healthcare access.',
    affiliation: 'center-left',
    credibility: 92,
    followers: 14200,
    verified: true,
  },
  {
    id: 'p2',
    name: 'Marcus Chen',
    handle: '@marcuschen',
    bio: 'Economics correspondent. Former WSJ. Tracking fiscal policy & markets.',
    affiliation: 'center',
    credibility: 88,
    followers: 8700,
    verified: true,
  },
  {
    id: 'p3',
    name: 'Rep. Sarah Mitchell',
    handle: '@sarahmitchell',
    bio: 'U.S. Representative, 4th District. Infrastructure & climate committee.',
    affiliation: 'center-left',
    credibility: 85,
    followers: 45000,
    verified: true,
  },
];

// ─── Component ──────────────────────────────────────────────

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch posts matching search term or selected topic
  const fetchResults = useCallback(async () => {
    const searchTerm = debouncedQuery || Array.from(selectedTopics)[0];
    if (!searchTerm) {
      setPosts([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/feed?hashtag=${encodeURIComponent(searchTerm)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedTopics]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedTopics(new Set());
    setPosts([]);
  };

  const hasQuery = debouncedQuery.length > 0 || selectedTopics.size > 0;

  // Filter mock people by query
  const filteredPeople = MOCK_PEOPLE.filter(
    (p) =>
      !debouncedQuery ||
      p.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      p.bio.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Sticky Search Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="px-4 sm:px-6 pt-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts, people, topics..."
                  className="w-full bg-surface-elevated border border-border-subtle rounded-xl pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic/40 transition-all"
                />
                {query && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 -mr-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Topic Chips ── */}
            <div className="px-4 sm:px-6 pb-3 overflow-x-auto scrollbar-none">
              <div className="flex gap-2 min-w-max">
                {TOPIC_CHIPS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={clsx(
                      'text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all',
                      selectedTopics.has(topic)
                        ? 'bg-civic text-white'
                        : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:bg-surface-hover hover:text-text-primary',
                    )}
                  >
                    #{topic}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex px-4 sm:px-6 border-t border-border-subtle">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2',
                    activeTab === tab.id
                      ? 'text-text-primary border-civic'
                      : 'text-text-muted border-transparent hover:text-text-secondary',
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {/* ── Content ── */}
          {!hasQuery ? (
            /* Empty state — no query */
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center mb-5">
                <Search className="w-7 h-7 text-text-muted" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-2">
                Search Civic Social
              </h2>
              <p className="text-sm text-text-secondary max-w-sm">
                Find posts, people, news, and debates. Use topic chips above to
                explore by category.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['healthcare', 'economy', 'climate', 'education'].map(
                  (topic) => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      className="text-xs font-medium text-civic-light bg-civic/10 px-3 py-1.5 rounded-full hover:bg-civic/20 transition-colors"
                    >
                      #{topic}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : loading ? (
            /* Loading state */
            <div className="flex flex-col items-center py-16 animate-fade-in">
              <Loader2 className="w-6 h-6 text-civic-light animate-spin mb-3" />
              <p className="text-sm text-text-muted">Searching...</p>
            </div>
          ) : (
            <div>
              {/* ── Post Results ── */}
              {(activeTab === 'all' || activeTab === 'posts') &&
                posts.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-4 sm:px-6 pt-4 pb-2">
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          Posts
                        </h3>
                      </div>
                    )}
                    <div className="divide-y divide-border-subtle">
                      {posts.map((post, i) => (
                        <PostCard key={post.id} post={post} index={i} />
                      ))}
                    </div>
                  </div>
                )}

              {/* ── People Results ── */}
              {(activeTab === 'all' || activeTab === 'people') &&
                filteredPeople.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="px-4 sm:px-6 pt-6 pb-2">
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                          People
                        </h3>
                      </div>
                    )}
                    <div className="divide-y divide-border-subtle">
                      {filteredPeople.map((person, i) => (
                        <div
                          key={person.id}
                          className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-4 hover:bg-surface/40 transition-colors"
                          style={{
                            animationDelay: `${i * 80}ms`,
                            animationFillMode: 'forwards',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-text-secondary text-sm font-semibold shrink-0">
                              {person.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-text-primary">
                                  {person.name}
                                </span>
                                {person.verified && (
                                  <span className="text-[10px] font-medium bg-positive/10 text-positive-light px-1.5 py-0.5 rounded-full">
                                    Verified
                                  </span>
                                )}
                                <span className="text-xs text-text-muted">
                                  {person.handle}
                                </span>
                              </div>
                              <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">
                                {person.bio}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[11px] text-text-muted">
                                  Credibility:{' '}
                                  <span className="font-semibold text-positive-light">
                                    {person.credibility}%
                                  </span>
                                </span>
                                <span className="text-[11px] text-text-muted">
                                  {person.followers.toLocaleString()} followers
                                </span>
                              </div>
                            </div>
                            <button className="text-xs font-semibold text-civic-light bg-civic/10 px-3 py-1.5 rounded-lg hover:bg-civic/20 transition-colors shrink-0">
                              Follow
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* ── News Results (mock) ── */}
              {(activeTab === 'all' || activeTab === 'news') && hasQuery && (
                <div>
                  {activeTab === 'all' && (
                    <div className="px-4 sm:px-6 pt-6 pb-2">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        News
                      </h3>
                    </div>
                  )}
                  <div className="divide-y divide-border-subtle">
                    {[
                      {
                        id: 'n1',
                        title: `Latest developments in ${debouncedQuery || Array.from(selectedTopics)[0]}`,
                        source: 'Reuters',
                        time: '2 hours ago',
                        trust: 96,
                      },
                      {
                        id: 'n2',
                        title: `Analysis: What ${debouncedQuery || Array.from(selectedTopics)[0]} policy changes mean`,
                        source: 'AP News',
                        time: '5 hours ago',
                        trust: 95,
                      },
                    ].map((article, i) => (
                      <div
                        key={article.id}
                        className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-4 hover:bg-surface/40 transition-colors"
                        style={{
                          animationDelay: `${i * 80}ms`,
                          animationFillMode: 'forwards',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Newspaper className="w-3.5 h-3.5 text-civic-light" />
                          <span className="text-xs font-semibold text-civic-light">
                            {article.source}
                          </span>
                          <span className="text-text-muted text-xs">·</span>
                          <span className="text-xs text-text-muted">
                            {article.time}
                          </span>
                          <span className="text-[10px] font-semibold bg-positive/10 text-positive-light px-1.5 py-0.5 rounded-md ml-auto">
                            Trust: {article.trust}%
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-text-primary hover:text-civic-light transition-colors cursor-pointer">
                          {article.title}
                        </h4>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Debates Results (mock) ── */}
              {(activeTab === 'all' || activeTab === 'debates') && hasQuery && (
                <div>
                  {activeTab === 'all' && (
                    <div className="px-4 sm:px-6 pt-6 pb-2">
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                        Debates
                      </h3>
                    </div>
                  )}
                  <div className="divide-y divide-border-subtle">
                    {[
                      {
                        id: 'd1',
                        title: `Should ${debouncedQuery || Array.from(selectedTopics)[0]} funding be increased?`,
                        participants: 24,
                        civility: 82,
                        type: 'Structured Debate',
                      },
                    ].map((debate, i) => (
                      <div
                        key={debate.id}
                        className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-4 hover:bg-surface/40 transition-colors"
                        style={{
                          animationDelay: `${i * 80}ms`,
                          animationFillMode: 'forwards',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-warning-light" />
                          <span className="text-[10px] font-medium bg-warning/10 text-warning-light px-1.5 py-0.5 rounded-md">
                            {debate.type}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-text-primary hover:text-civic-light transition-colors cursor-pointer">
                          {debate.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {debate.participants} participants
                          </span>
                          <span className="text-[11px] text-text-muted">
                            Civility:{' '}
                            <span className="font-semibold text-positive-light">
                              {debate.civility}%
                            </span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── No results ── */}
              {posts.length === 0 &&
                filteredPeople.length === 0 &&
                activeTab === 'posts' && (
                  <div className="flex flex-col items-center py-16 text-center animate-fade-in">
                    <TrendingUp className="w-10 h-10 text-text-muted mb-3" />
                    <p className="text-sm text-text-secondary">
                      No results found for &ldquo;{debouncedQuery}&rdquo;
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Try a different search term or topic
                    </p>
                  </div>
                )}
            </div>
          )}

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
