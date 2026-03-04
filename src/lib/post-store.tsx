'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

// ─── Types matching PostData from post-card.tsx ──────────────

export interface UserPost {
  id: string;
  content: string;
  createdAt: string;
  topics: string[];
  articleUrl?: string;
  author: {
    id: string;
    displayName: string;
    affiliations: string[];
    verificationLevel: string;
    civicReputation: number;
  };
  thread: null;
  sources: { url: string; domain: string; trustScore: number }[];
  reactions: { agree: number; disagree: number; insightful: number; nuance: number };
  algorithm: {
    qualityScore: number;
    signals: {
      engagementQuality: number;
      civility: number;
      viewpointDiversity: number;
      sourceCredibility: number;
      topicRelevance: number;
      authorReputation: number;
      penalty: number;
    };
    explanation: string;
    explanationTags: string[];
  };
  replies: never[];
  comment_policy?: 'everyone' | 'followers_only' | 'off';
  comment_count?: number;
  // Optimistic UI metadata
  _optimistic?: boolean;
  _failed?: boolean;
}

interface PostStoreContextValue {
  userPosts: UserPost[];
  addPost: (post: {
    content: string;
    topics: string[];
    articleUrl?: string;
    civilityScore: number;
  }) => UserPost;
  removePost: (id: string) => void;
  markPostFailed: (id: string) => void;
  confirmPost: (id: string, serverPost?: Partial<UserPost>) => void;
  getPostsForFeed: (feedType: 'for-you' | 'following') => UserPost[];
  getPostsForProfile: () => UserPost[];
  postCount: number;
  hydrated: boolean;
  /** Re-fetch current user's posts from server (e.g. pull-to-refresh on profile) */
  refresh: () => Promise<void>;
}

const PostStoreContext = createContext<PostStoreContextValue>({
  userPosts: [],
  addPost: () => ({} as UserPost),
  removePost: () => {},
  markPostFailed: () => {},
  confirmPost: () => {},
  getPostsForFeed: () => [],
  getPostsForProfile: () => [],
  postCount: 0,
  hydrated: false,
  refresh: async () => {},
});

// ─── Provider ────────────────────────────────────────────────

export function PostStoreProvider({ children }: { children: ReactNode }) {
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();

  const doHydrate = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    const authorId = currentUserId;
    try {
      const res = await fetch(`/api/posts?author=${encodeURIComponent(authorId)}&_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      const fallbackAuthor: UserPost['author'] = {
        id: authorId,
        displayName: user?.displayName || 'You',
        affiliations: [user?.onboarding?.affiliation || 'center'],
        verificationLevel: 'EMAIL_VERIFIED',
        civicReputation: 0.5,
      };
      const serverPosts: UserPost[] = (data.posts ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        content: p.content as string,
        createdAt: p.createdAt as string,
        topics: (p.topics ?? []) as string[],
        articleUrl: p.articleUrl as string | undefined,
        author: (p.author ?? fallbackAuthor) as UserPost['author'],
        thread: null,
        sources: (p.sources ?? []) as UserPost['sources'],
        reactions: (p.reactions ?? { agree: 0, disagree: 0, insightful: 0, nuance: 0 }) as UserPost['reactions'],
        algorithm: (p.algorithm ?? {
          qualityScore: 0.5,
          signals: { engagementQuality: 0, civility: 0.8, viewpointDiversity: 0, sourceCredibility: 0, topicRelevance: 0.3, authorReputation: 0.92, penalty: 0 },
          explanation: 'Your post.',
          explanationTags: ['your-post'],
        }) as UserPost['algorithm'],
        replies: [] as never[],
        _optimistic: false,
        _failed: false,
      }));
      setUserPosts((prev) => {
        const serverIds = new Set(serverPosts.map((p) => p.id));
        const optimisticOnly = prev.filter((p) => p._optimistic && !serverIds.has(p.id));
        return [...optimisticOnly, ...serverPosts];
      });
    } catch {
      // Offline or error — keep what we have
    } finally {
      setHydrated(true);
    }
  }, [user?.id, user?.displayName, user?.onboarding?.affiliation]);

  useEffect(() => {
    if (!user?.id) return;
    doHydrate();
  }, [user?.id, doHydrate]);

  const addPost = useCallback((input: {
    content: string;
    topics: string[];
    articleUrl?: string;
    civilityScore: number;
  }): UserPost => {
    const currentAuthor = {
      id: user?.id || 'user-current',
      displayName: user?.displayName || 'You',
      affiliations: [user?.onboarding?.affiliation || 'center'],
      verificationLevel: 'EMAIL_VERIFIED',
      civicReputation: 0.5,
    };
    const newPost: UserPost = {
      id: `user-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: input.content,
      createdAt: new Date().toISOString(),
      topics: input.topics,
      articleUrl: input.articleUrl,
      author: currentAuthor,
      thread: null,
      sources: (() => {
        if (!input.articleUrl) return [];
        try {
          const domain = new URL(input.articleUrl).hostname.replace('www.', '');
          return [{ url: input.articleUrl, domain, trustScore: 0.7 }];
        } catch {
          return [];
        }
      })(),
      reactions: { agree: 0, disagree: 0, insightful: 0, nuance: 0 },
      algorithm: {
        qualityScore: 0.5 + input.civilityScore * 0.3,
        signals: {
          engagementQuality: 0,
          civility: input.civilityScore,
          viewpointDiversity: 0,
          sourceCredibility: input.articleUrl ? 0.6 : 0,
          topicRelevance: input.topics.length > 0 ? 0.7 : 0.3,
          authorReputation: currentAuthor.civicReputation,
          penalty: 0,
        },
        explanation: 'Your post — shown to you and your followers.',
        explanationTags: ['your-post'],
      },
      replies: [],
      _optimistic: true,
    };

    setUserPosts((prev) => [newPost, ...prev]);
    return newPost;
  }, [user?.id, user?.displayName, user?.onboarding?.affiliation]);

  const removePost = useCallback((id: string) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const markPostFailed = useCallback((id: string) => {
    setUserPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, _failed: true, _optimistic: false } : p)),
    );
  }, []);

  const confirmPost = useCallback((id: string, serverPost?: Partial<UserPost>) => {
    setUserPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // Merge server data if provided (e.g., server-assigned ID, createdAt)
        if (serverPost) {
          return { ...p, ...serverPost, _optimistic: false, _failed: false };
        }
        return { ...p, _optimistic: false };
      }),
    );
  }, []);

  const getPostsForFeed = useCallback(
    (feedType: 'for-you' | 'following'): UserPost[] => {
      // User's own posts always show in Following feed
      // In For You, only show if algorithm would rank them (for now, always show)
      const validPosts = userPosts.filter((p) => !p._failed);
      if (feedType === 'following') return validPosts;
      // For You: include own posts (Twitter parity)
      return validPosts;
    },
    [userPosts],
  );

  const getPostsForProfile = useCallback((): UserPost[] => {
    return userPosts.filter((p) => !p._failed);
  }, [userPosts]);

  return (
    <PostStoreContext.Provider
      value={{
        userPosts,
        addPost,
        removePost,
        markPostFailed,
        confirmPost,
        getPostsForFeed,
        getPostsForProfile,
        postCount: userPosts.filter((p) => !p._failed).length,
        hydrated,
        refresh: doHydrate,
      }}
    >
      {children}
    </PostStoreContext.Provider>
  );
}

export function usePostStore() {
  return useContext(PostStoreContext);
}
