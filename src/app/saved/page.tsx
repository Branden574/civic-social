'use client';

import { useState } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import Link from 'next/link';
import {
  Bookmark,
  BookmarkX,
  FileText,
  MessageCircle,
  Lightbulb,
  Inbox,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Types ──────────────────────────────────────────────────

type SavedCategory = 'all' | 'articles' | 'discussions' | 'proposals';

interface SavedItem {
  id: string;
  title: string;
  author: string;
  authorHandle: string;
  savedAt: Date;
  snippet: string;
  topics: string[];
  category: SavedCategory;
  type: string;
}

// ─── Mock Data ──────────────────────────────────────────────

const MOCK_SAVED: SavedItem[] = [
  {
    id: 's1',
    title: 'The Case for Universal Pre-K: Evidence from Three State Programs',
    author: 'Dr. Elena Vasquez',
    authorHandle: '@evasquez',
    savedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    snippet:
      'A comprehensive analysis of pre-K programs in Georgia, Oklahoma, and New York shows consistent gains in early literacy scores. Long-term tracking reveals reduced special education placement and higher graduation rates...',
    topics: ['education', 'policy'],
    category: 'articles',
    type: 'Article',
  },
  {
    id: 's2',
    title: 'Debate: Should carbon tax revenue be redistributed as dividends?',
    author: 'CivicDebates',
    authorHandle: '@civicdebates',
    savedAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
    snippet:
      'A structured debate with 48 participants across the political spectrum. Key points include revenue neutrality, economic impact modeling, and international competitiveness concerns...',
    topics: ['climate', 'economy', 'taxation'],
    category: 'discussions',
    type: 'Discussion',
  },
  {
    id: 's3',
    title: 'Proposal: Bipartisan Infrastructure Maintenance Fund',
    author: 'Rep. Sarah Mitchell',
    authorHandle: '@sarahmitchell',
    savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    snippet:
      'A policy proposal to establish a dedicated infrastructure maintenance fund financed through public-private partnerships. The fund would prioritize bridges, water systems, and broadband in underserved areas...',
    topics: ['infrastructure', 'housing'],
    category: 'proposals',
    type: 'Policy Proposal',
  },
  {
    id: 's4',
    title: 'How Finland Redesigned Criminal Justice — and What We Can Learn',
    author: 'Marcus Chen',
    authorHandle: '@marcuschen',
    savedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    snippet:
      "Finland's open prison model has achieved recidivism rates under 30%. This deep-dive explores the cultural, structural, and policy differences that make their system work and whether elements can translate to the US context...",
    topics: ['criminal-justice', 'foreign-policy'],
    category: 'articles',
    type: 'Article',
  },
];

const TABS: { id: SavedCategory; label: string; icon: typeof Bookmark }[] = [
  { id: 'all', label: 'All', icon: Bookmark },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
  { id: 'proposals', label: 'Policy Proposals', icon: Lightbulb },
];

// ─── Component ──────────────────────────────────────────────

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState<SavedCategory>('all');
  const [items, setItems] = useState<SavedItem[]>(MOCK_SAVED);

  const filtered =
    activeTab === 'all'
      ? items
      : items.filter((item) => item.category === activeTab);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="px-4 sm:px-6 pt-4 pb-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-civic-subtle flex items-center justify-center">
                  <Bookmark className="w-5 h-5 text-civic-light" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-text-primary">
                    Saved Posts
                  </h1>
                  <p className="text-xs text-text-muted">
                    {items.length} saved item{items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex px-4 sm:px-6">
              {TABS.map((tab) => {
                const count =
                  tab.id === 'all'
                    ? items.length
                    : items.filter((i) => i.category === tab.id).length;
                return (
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
                    {count > 0 && (
                      <span
                        className={clsx(
                          'text-xs font-bold px-1.5 py-0.5 rounded-full',
                          activeTab === tab.id
                            ? 'bg-civic-muted text-civic-light'
                            : 'bg-surface-active text-text-muted',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </header>

          {/* ── Content ── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center mb-5">
                <Inbox className="w-7 h-7 text-text-muted" />
              </div>
              <h2 className="text-base font-bold text-text-primary mb-2">
                No saved items
              </h2>
              <p className="text-sm text-text-secondary max-w-sm">
                {activeTab === 'all'
                  ? 'Bookmark posts, articles, and proposals to find them here later.'
                  : `No saved ${activeTab} yet. Browse the feed and save items you want to revisit.`}
              </p>
              <Link
                href="/"
                className="mt-4 text-sm font-semibold text-civic-light hover:underline"
              >
                Browse Feed
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {filtered.map((item, i) => (
                <article
                  key={item.id}
                  className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-5 hover:bg-surface/40 transition-colors group"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Meta row */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-civic-light">
                          {item.author}
                        </span>
                        <span className="text-xs text-text-muted">
                          {item.authorHandle}
                        </span>
                        <span className="text-text-muted text-xs">·</span>
                        <span className="text-xs text-text-muted">
                          Saved{' '}
                          {formatDistanceToNow(item.savedAt, {
                            addSuffix: true,
                          })}
                        </span>
                        <span
                          className={clsx(
                            'text-xs font-medium px-1.5 py-0.5 rounded-md ml-auto',
                            item.category === 'articles'
                              ? 'bg-info/10 text-info-light'
                              : item.category === 'discussions'
                                ? 'bg-warning/10 text-warning-light'
                                : 'bg-positive/10 text-positive-light',
                          )}
                        >
                          {item.type}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-text-primary leading-snug mb-1.5 hover:text-civic-light transition-colors cursor-pointer">
                        {item.title}
                      </h3>

                      {/* Snippet */}
                      <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                        {item.snippet}
                      </p>

                      {/* Topics */}
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        {item.topics.map((topic) => (
                          <span
                            key={topic}
                            className="text-xs font-medium text-civic-light bg-civic-subtle px-2 py-0.5 rounded-full"
                          >
                            #{topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 rounded-xl text-text-muted hover:text-danger-light hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remove from saved"
                    >
                      <BookmarkX className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}
