'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { PostCard, PostData } from '@/components/feed/post-card';
import { Hash, ArrowLeft, Newspaper, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { AuthGate } from '@/components/auth/auth-gate';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

type ContentTab = 'posts' | 'news';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceDomain: string;
  publishedAt: string;
  imageUrl: string | null;
  topics: string[];
  factCheckStatus: string;
  sourceTrustScore: number;
  discussionCount: number;
}

export default function HashtagPage() {
  const params = useParams();
  const tag = typeof params.tag === 'string' ? decodeURIComponent(params.tag) : '';
  const [posts, setPosts] = useState<PostData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentTab, setContentTab] = useState<ContentTab>('posts');

  useEffect(() => {
    if (!tag) return;
    setLoading(true);
    fetch(`/api/hashtag/${encodeURIComponent(tag)}?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts || []);
        setNews(data.news || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tag]);

  const totalCount = posts.length + news.length;

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
              <Link
                href="/"
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-civic/10 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-civic-light" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-text-primary">#{tag}</h1>
                  <p className="text-xs text-text-muted">{posts.length} {posts.length === 1 ? 'post' : 'posts'} · {news.length} news</p>
                </div>
              </div>
            </div>

            {/* Content tabs */}
            <div className="flex items-center gap-1 px-4 sm:px-6 pb-2">
              <button
                onClick={() => setContentTab('posts')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  contentTab === 'posts' ? 'bg-civic/10 text-civic-light' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Posts ({posts.length})
              </button>
              <button
                onClick={() => setContentTab('news')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  contentTab === 'news' ? 'bg-civic/10 text-civic-light' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
                )}
              >
                <Newspaper className="w-3.5 h-3.5" />
                News ({news.length})
              </button>
            </div>
          </header>

          {/* Loading */}
          {loading && (
            <div className="px-4 sm:px-6 py-12 text-center">
              <div className="inline-flex items-center gap-3 text-text-muted">
                <div className="w-5 h-5 border-2 border-civic/30 border-t-civic rounded-full animate-spin" />
                <span className="text-sm">Finding content for #{tag}...</span>
              </div>
            </div>
          )}

          {/* Posts tab */}
          {!loading && contentTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <Hash className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">No posts found for #{tag}</p>
                  <p className="text-xs text-text-muted mt-1">Be the first to start a discussion on this topic.</p>
                </div>
              ) : (
                <div>
                  {posts.map((post, i) => (
                    <PostCard key={post.id} post={post} index={i} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* News tab */}
          {!loading && contentTab === 'news' && (
            <>
              {news.length === 0 ? (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <Newspaper className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">No news articles found for #{tag}</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {news.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 sm:px-6 py-4 hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{article.source}</span>
                            <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
                          </div>
                          <h3 className="text-sm font-medium text-text-primary line-clamp-2 mb-1">{article.title}</h3>
                          <p className="text-xs text-text-muted line-clamp-2">{article.summary}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {article.topics.slice(0, 3).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-active text-text-muted">#{t}</span>
                            ))}
                            <ExternalLink className="w-3 h-3 text-text-muted ml-auto" />
                          </div>
                        </div>
                        {article.imageUrl && (
                          <img src={article.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}
