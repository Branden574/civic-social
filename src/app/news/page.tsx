'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { mockNewsArticles } from '@/lib/data/mock-data';
import {
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Newspaper,
  ChevronDown,
  ChevronUp,
  Eye,
  Shield,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { AuthGate } from '@/components/auth/auth-gate';

const factCheckStyles: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  VERIFIED: { icon: CheckCircle2, label: 'Fact-Checked', color: 'text-positive bg-positive/10' },
  UNCHECKED: { icon: Clock, label: 'Unverified', color: 'text-text-muted bg-surface-active' },
  DISPUTED: { icon: AlertTriangle, label: 'Disputed', color: 'text-danger bg-danger/10' },
  PARTIALLY_TRUE: { icon: AlertTriangle, label: 'Partially True', color: 'text-warning bg-warning/10' },
};

// Mock multiple perspectives for articles
const PERSPECTIVES: Record<string, { ideology: string; source: string; angle: string; color: string }[]> = {
  default: [
    { ideology: 'Left-leaning', source: 'The Guardian', angle: 'Emphasizes social impact and equity concerns', color: 'bg-ideology-left' },
    { ideology: 'Center', source: 'Reuters', angle: 'Focuses on factual reporting and economic data', color: 'bg-ideology-center' },
    { ideology: 'Right-leaning', source: 'Wall Street Journal', angle: 'Highlights market effects and fiscal responsibility', color: 'bg-ideology-right' },
  ],
  healthcare: [
    { ideology: 'Progressive', source: 'New York Times', angle: 'Advocates for expanded access and universal coverage', color: 'bg-ideology-left' },
    { ideology: 'Moderate', source: 'AP News', angle: 'Reports on bipartisan reform efforts and costs', color: 'bg-ideology-center' },
    { ideology: 'Conservative', source: 'National Review', angle: 'Emphasizes market-based solutions and deregulation', color: 'bg-ideology-right' },
  ],
  economy: [
    { ideology: 'Left-leaning', source: 'The Economist', angle: 'Examines inequality and structural factors', color: 'bg-ideology-left' },
    { ideology: 'Center', source: 'BBC', angle: 'Covers global economic trends and trade data', color: 'bg-ideology-center' },
    { ideology: 'Right-leaning', source: 'Financial Times', angle: 'Focuses on business confidence and investment climate', color: 'bg-ideology-right' },
  ],
};

function getPerspectives(topics: string[]) {
  for (const topic of topics) {
    const t = topic.toLowerCase();
    if (PERSPECTIVES[t]) return PERSPECTIVES[t];
  }
  return PERSPECTIVES.default;
}

export default function NewsPage() {
  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Newspaper className="w-5 h-5 text-civic-light" />
                <div>
                  <h1 className="text-lg font-bold text-text-primary">
                    Global Civic News
                  </h1>
                  <p className="text-xs text-text-muted">
                    Verified outlets only · AI summaries · Multiple perspectives
                  </p>
                </div>
              </div>
              <Link
                href="/source-transparency"
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-civic-light transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Source Criteria</span>
              </Link>
            </div>
          </header>

          {/* News Feed */}
          <div className="divide-y divide-border-subtle">
            {mockNewsArticles.map((article, i) => (
              <NewsArticleCard key={article.id} article={article} index={i} />
            ))}
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}

interface NewsArticle {
  id: string;
  source: string;
  title: string;
  summary: string;
  publishedAt: Date;
  factCheckStatus: string;
  topics: string[];
  discussionCount: number;
  sourceTrustScore: number;
}

function NewsArticleCard({ article, index }: { article: NewsArticle; index: number }) {
  const [showPerspectives, setShowPerspectives] = useState(false);
  const [saved, setSaved] = useState(false);
  const factCheck = factCheckStyles[article.factCheckStatus];
  const perspectives = getPerspectives(article.topics);

  return (
    <article
      className="feed-item animate-fade-in opacity-0 px-4 sm:px-6 py-5 hover:bg-surface/40 transition-colors"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'forwards',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Source + time */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-semibold text-civic-light">
              {article.source}
            </span>
            <span className="text-text-muted text-xs">·</span>
            <span className="text-xs text-text-muted">
              {formatDistanceToNow(article.publishedAt, { addSuffix: true })}
            </span>
            <span className="text-text-muted text-xs">·</span>
            <span
              className={clsx(
                'flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                factCheck.color,
              )}
            >
              <factCheck.icon className="w-3 h-3" />
              {factCheck.label}
            </span>
            <span className="text-[10px] text-text-muted flex items-center gap-1 ml-auto">
              Trust:{' '}
              <span className="font-semibold text-positive-light">
                {Math.round(article.sourceTrustScore * 100)}%
              </span>
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base font-semibold text-text-primary leading-snug mb-2 hover:text-civic-light transition-colors cursor-pointer">
            {article.title}
          </h2>

          {/* AI Summary */}
          <div className="bg-surface-elevated rounded-lg p-3 mb-3 border border-border-subtle">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-civic animate-pulse" />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                AI Summary · Neutral Tone
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {article.summary}
            </p>
          </div>

          {/* Multiple Perspectives Panel */}
          <button
            onClick={() => setShowPerspectives(!showPerspectives)}
            className="flex items-center gap-2 w-full text-left mb-3 px-3 py-2 bg-surface rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
          >
            <Eye className="w-4 h-4 text-civic-light shrink-0" />
            <span className="text-xs font-semibold text-text-primary flex-1">
              Multiple Perspectives
            </span>
            <span className="text-[10px] text-text-muted">{perspectives.length} viewpoints</span>
            {showPerspectives ? (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {showPerspectives && (
            <div className="mb-3 space-y-2 animate-fade-in">
              {perspectives.map((p) => (
                <div
                  key={p.ideology}
                  className="flex items-start gap-2.5 px-3 py-2.5 bg-surface-elevated rounded-lg border border-border-subtle"
                >
                  <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', p.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-semibold text-text-primary">{p.ideology}</span>
                      <span className="text-[10px] text-text-muted">via {p.source}</span>
                    </div>
                    <p className="text-[12px] text-text-secondary leading-relaxed">{p.angle}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-text-muted text-center pt-1">
                Perspectives generated from coverage by multiple verified outlets
              </p>
            </div>
          )}

          {/* Topics */}
          <div className="flex items-center gap-2 flex-wrap">
            {article.topics.map((topic) => (
              <Link
                key={topic}
                href={`/hashtag/${encodeURIComponent(topic)}`}
                className="text-[11px] font-medium text-civic-light bg-civic/8 px-2 py-0.5 rounded-full hover:bg-civic/15 transition-colors"
              >
                #{topic}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 sm:gap-4 mt-3 flex-wrap">
            <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-civic-light transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              {article.discussionCount} discussions
            </button>
            <a
              href="#"
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-civic-light transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Read full article
            </a>
            <button
              onClick={() => setSaved(!saved)}
              className={clsx(
                'flex items-center gap-1.5 text-xs transition-colors',
                saved ? 'text-civic-light' : 'text-text-muted hover:text-civic-light',
              )}
            >
              {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
