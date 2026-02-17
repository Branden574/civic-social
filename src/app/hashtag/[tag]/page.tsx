'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { PostCard, PostData } from '@/components/feed/post-card';
import { Hash, TrendingUp, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AuthGate } from '@/components/auth/auth-gate';

export default function HashtagPage() {
  const params = useParams();
  const tag = typeof params.tag === 'string' ? decodeURIComponent(params.tag) : '';
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;
    setLoading(true);
    fetch(`/api/feed?tab=for-you&hashtag=${encodeURIComponent(tag)}`)
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tag]);

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
                  <h1 className="text-lg font-bold text-text-primary">
                    #{tag}
                  </h1>
                  <p className="text-xs text-text-muted">
                    {posts.length} posts in this topic
                  </p>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 px-4 sm:px-6 pb-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Trending
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {posts.length > 0 ? 'Active discussion' : 'No posts yet'}
              </span>
            </div>
          </header>

          {/* Loading */}
          {loading && (
            <div className="px-4 sm:px-6 py-12 text-center">
              <div className="inline-flex items-center gap-3 text-text-muted">
                <div className="w-5 h-5 border-2 border-civic/30 border-t-civic rounded-full animate-spin" />
                <span className="text-sm">Finding posts for #{tag}...</span>
              </div>
            </div>
          )}

          {/* Posts */}
          {!loading && posts.length === 0 && (
            <div className="px-4 sm:px-6 py-16 text-center">
              <Hash className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">
                No posts found for #{tag}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Be the first to start a discussion on this topic.
              </p>
            </div>
          )}

          {!loading && posts.length > 0 && (
            <div>
              {posts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
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
