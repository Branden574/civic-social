// ═══════════════════════════════════════════════════════════════
// Civic Social — Feed API (Hardened)
// ═══════════════════════════════════════════════════════════════
// GET /api/feed?tab=for-you|following&limit=50&hashtag=topic&sort=top|latest
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateFeed } from '@/lib/algorithm';
import { generateColdStartFeed, type ColdStartProfile } from '@/lib/algorithm/cold-start';
import { mockCandidates, mockUsers, mockReplies } from '@/lib/data/mock-data';
import type { FeedCandidate } from '@/lib/algorithm';
import { getDeletedPostIds } from '@/lib/deleted-posts';
import { getAllPublishedPosts, getCommentCountsBatch, type PersistedPost } from '@/lib/post-data-store';
import { getReleasedNewPosts } from '@/lib/simulated-new-posts';
import { getClientIp, getSessionUser, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText, sanitizeUrl, clampInt } from '@/lib/security/sanitize';
import { dbGetFollowingIds } from '@/lib/social-store';
import { getUserById, registerUser } from '@/lib/user-registry';

// ─── Safety filter (shared by both modes) ────────────────────
function applySafetyFilter(candidates: FeedCandidate[]): { safe: FeedCandidate[]; filtered: number } {
  const deletedIds = getDeletedPostIds();
  const safe = candidates.filter((c) => {
    if (deletedIds.has(c.post.id)) return false;
    if (c.post.botLikelihood > 0.9) return false;
    if (c.post.flagCount > 20) return false;
    if (c.post.toxicityScore > 0.95) return false;
    return true;
  });
  return { safe, filtered: candidates.length - safe.length };
}

// ─── Serialize for "latest" mode (no algorithm scores) ───────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function serializeChronologicalPost(c: FeedCandidate, counts: Map<string, number>) {
  const registryUser = await getUserById(c.author.id);
  return {
    id: c.post.id,
    content: c.post.content,
    createdAt: c.post.createdAt.toISOString(),
    topics: c.post.topics,
    author: {
      id: c.author.id,
      displayName: c.author.displayName,
      avatarUrl: registryUser?.avatarUrl || null,
      affiliations: c.author.affiliations,
      verificationLevel: c.author.verificationLevel,
      civicReputation: c.author.civicReputation,
    },
    thread: c.thread
      ? {
          id: c.thread.id,
          type: c.thread.type,
          topics: c.thread.topics,
          participantCount: c.thread.participantCount,
          civilityScore: c.thread.civilityScore,
          diversityScore: c.thread.diversityScore,
        }
      : null,
    sources: c.post.sources.map((s: any) => ({
      url: s.url,
      domain: s.domain,
      trustScore: s.trustScore,
    })),
    reactions: {
      agree: c.post.agreeCount,
      disagree: c.post.disagreeCount,
      insightful: c.post.insightfulCount,
      nuance: c.post.nuanceCount,
    },
    algorithm: {
      qualityScore: 0,
      signals: {
        engagementQuality: 0,
        civility: Math.round(c.post.civilityScore * 100) / 100,
        viewpointDiversity: 0,
        sourceCredibility: 0,
        topicRelevance: 0,
        authorReputation: Math.round(c.author.civicReputation * 100) / 100,
        penalty: 0,
      },
      explanation: 'Showing in chronological order — most recent first.',
      explanationTags: ['chronological'],
    },
    comment_policy: 'everyone' as const,
    comment_count: (counts.get(c.post.id) ?? 0) + mockReplies.filter((r) => r.postId === c.post.id).length,
    replies: mockReplies
      .filter((r) => r.postId === c.post.id)
      .map((r) => ({
        id: r.id,
        content: r.content,
        author: {
          id: r.author.id,
          displayName: r.author.displayName,
          avatarUrl: null as string | null,
          affiliations: r.author.affiliations,
          verificationLevel: r.author.verificationLevel,
        },
        createdAt: r.createdAt.toISOString(),
        civilityScore: r.civilityScore,
        reactions: {
          agree: r.agreeCount,
          disagree: r.disagreeCount,
          insightful: r.insightfulCount,
        },
      })),
  };
}

// ─── Serialize a user-created PersistedPost for feed response ─
async function serializeUserPost(p: PersistedPost, counts: Map<string, number>) {
  const safeUrl = p.articleUrl ? sanitizeUrl(p.articleUrl) : null;
  const registryUser = await getUserById(p.authorId);
  const civicRep = registryUser ? Math.max(0, Math.min(1, registryUser.credibilityScore / 100)) : 0.5;
  const authorProfile = {
    id: p.authorId,
    displayName: registryUser?.displayName || (p.authorId === 'user-current' ? 'Branden Vincent-Walker' : 'User'),
    avatarUrl: registryUser?.avatarUrl || null,
    affiliations: [registryUser?.affiliation || 'center'],
    verificationLevel: registryUser?.verificationLevel || 'EMAIL_VERIFIED',
    civicReputation: civicRep,
  };
  return {
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
    topics: p.topics,
    author: authorProfile,
    thread: null,
    sources: safeUrl
      ? [{ url: safeUrl, domain: new URL(safeUrl).hostname.replace('www.', ''), trustScore: 0.7 }]
      : [],
    reactions: { agree: 0, disagree: 0, insightful: 0, nuance: 0 },
    algorithm: {
      qualityScore: 0.5 + p.civilityScore * 0.3,
      signals: {
        engagementQuality: 0,
        civility: Math.round(p.civilityScore * 100) / 100,
        viewpointDiversity: 0,
        sourceCredibility: p.articleUrl ? 0.6 : 0,
        topicRelevance: p.topics.length > 0 ? 0.7 : 0.3,
        authorReputation: civicRep,
        penalty: 0,
      },
      explanation: 'Your post — shown to you and your followers.',
      explanationTags: ['your-post'],
    },
    comment_policy: p.comment_policy ?? 'everyone',
    comment_count: counts.get(p.id) ?? 0,
    postType: p.postType || 'OPEN_DISCUSSION',
    replies: [],
  };
}

export async function GET(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'for-you';
  const limit = clampInt(searchParams.get('limit'), 1, 100, 50); // Capped at 100 (was 250)
  const hashtag = sanitizeText(searchParams.get('hashtag') || '').toLowerCase();
  const sort = searchParams.get('sort') === 'latest' ? 'latest' : 'top';

  const sessionUser = getSessionUser(request);
  if (sessionUser) {
    await registerUser({
      id: sessionUser.id,
      displayName: sessionUser.displayName,
      username: sessionUser.displayName.toLowerCase().replace(/\s+/g, '-'),
      email: sessionUser.email,
    });
  }
  const viewerId = sessionUser?.id ?? mockUsers.current.id;
  const user = mockUsers.current;

  // ── Fetch user-created posts from server store ─────────────
  const deletedIds = getDeletedPostIds();
  const allPublished = await getAllPublishedPosts();
  const userPosts = allPublished.filter((p) => !deletedIds.has(p.id));

  // ── Merge mock candidates + simulated new posts ────────────
  const simulatedPosts = getReleasedNewPosts();
  const existingIds = new Set(mockCandidates.map((c) => c.post.id));
  const newSimulated = simulatedPosts.filter((s) => !existingIds.has(s.post.id));
  let candidates: FeedCandidate[] = [...newSimulated, ...mockCandidates];

  // ── Batch-fetch all comment counts in a single DB query ────
  const allPostIds = [...userPosts.map((p) => p.id), ...candidates.map((c) => c.post.id)];
  const counts = await getCommentCountsBatch(allPostIds);

  const allPublishedUserCreatedPosts = await Promise.all(userPosts.map((p) => serializeUserPost(p, counts)));

  // Filter by hashtag if provided (exact match, not substring)
  if (hashtag) {
    candidates = candidates.filter((c) =>
      c.post.topics.some((t) => t.toLowerCase() === hashtag),
    );
  }

  const followingFromStore = await dbGetFollowingIds(viewerId);
  const followingPlusSelf = [...new Set([...followingFromStore, viewerId])];

  // ════════════════════════════════════════════════════════════
  // LATEST MODE
  // ════════════════════════════════════════════════════════════
  if (sort === 'latest') {
    let pool = candidates;
    if (tab === 'following') {
      pool = pool.filter((c) => followingPlusSelf.includes(c.author.id));
    }

    const { safe, filtered } = applySafetyFilter(pool);
    const sorted = [...safe].sort(
      (a, b) => b.post.createdAt.getTime() - a.post.createdAt.getTime(),
    );

    const trimmed = sorted.slice(0, limit);
    const mockSerialized = await Promise.all(trimmed.map((c) => serializeChronologicalPost(c, counts)));
    const relevantUserPosts = tab === 'following'
      ? allPublishedUserCreatedPosts.filter((p) => followingPlusSelf.includes(p.author.id))
      : allPublishedUserCreatedPosts;
    const allPosts = [...relevantUserPosts, ...mockSerialized]
      .sort((a, b) => {
        const bt = new Date(b.createdAt).getTime();
        const at = new Date(a.createdAt).getTime();
        if (bt !== at) return bt - at;
        return b.id.localeCompare(a.id);
      })
      .slice(0, limit);

    return NextResponse.json({
      tab,
      sort: 'latest',
      posts: allPosts,
      diversity: null,
      meta: {
        totalCandidates: pool.length + relevantUserPosts.length,
        filteredCount: filtered,
        hashtag: hashtag || null,
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // TOP MODE — Full algorithmic ranking
  // ════════════════════════════════════════════════════════════
  if (tab === 'following') {
    const followingCandidates = candidates.filter((c) =>
      followingPlusSelf.includes(c.author.id),
    );
    const feed = generateFeed(followingCandidates, user, undefined, limit);
    const relevantUserPosts = allPublishedUserCreatedPosts.filter((p) =>
      followingPlusSelf.includes(p.author.id),
    );
    const followingPosts = [...relevantUserPosts, ...await Promise.all(feed.posts.map((rp) => serializeRankedPost(rp, counts)))];
    return NextResponse.json({
      tab: 'following',
      sort: 'top',
      posts: followingPosts,
      diversity: feed.diversity,
      meta: {
        totalCandidates: feed.totalCandidates + relevantUserPosts.length,
        filteredCount: feed.filteredCount,
        hashtag: hashtag || null,
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // COLD-START MODE
  // ════════════════════════════════════════════════════════════
  const isNewUser = searchParams.get('newUser') === 'true';
  const userTopics = (searchParams.get('topics') || '').split(',').filter(Boolean).map((t) => sanitizeText(t)).slice(0, 10);
  const userCountry = sanitizeText(searchParams.get('country') || 'US').slice(0, 5);
  const userAffiliation = sanitizeText(searchParams.get('affiliation') || '').slice(0, 30);
  const daysSinceSignup = clampInt(searchParams.get('days'), 0, 365, 0);

  if (isNewUser && daysSinceSignup < 7) {
    const interactions = clampInt(searchParams.get('interactions'), 0, 10000, 0);
    const coldStartProfile: ColdStartProfile = {
      topics: userTopics.length > 0 ? userTopics : user.topicInterests,
      country: userCountry,
      affiliation: userAffiliation,
      daysSinceSignup,
      interactionCount: interactions,
    };

    const coldFeed = generateColdStartFeed(candidates, user, coldStartProfile, limit);

    return NextResponse.json({
      tab: 'for-you',
      sort: 'top',
      posts: await Promise.all(coldFeed.posts.map((rp) => serializeRankedPost(rp, counts))),
      diversity: coldFeed.diversity,
      meta: {
        totalCandidates: coldFeed.totalCandidates,
        filteredCount: coldFeed.filteredCount,
        hashtag: hashtag || null,
        coldStart: {
          active: coldFeed.coldStartActive,
          warmupProgress: coldFeed.warmupProgress,
          phase: coldFeed.phase,
        },
      },
    });
  }

  // For You tab: full algorithmic ranking
  const feed = generateFeed(candidates, user, undefined, limit);
  const forYouPosts = [...allPublishedUserCreatedPosts, ...await Promise.all(feed.posts.map((rp) => serializeRankedPost(rp, counts)))];

  return NextResponse.json({
    tab: 'for-you',
    sort: 'top',
    posts: forYouPosts,
    diversity: feed.diversity,
    meta: {
      totalCandidates: feed.totalCandidates + allPublishedUserCreatedPosts.length,
      filteredCount: feed.filteredCount,
      hashtag: hashtag || null,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function serializeRankedPost(rp: any, counts: Map<string, number>) {
  const registryUser = await getUserById(rp.candidate.author.id);
  return {
    id: rp.candidate.post.id,
    content: rp.candidate.post.content,
    createdAt: rp.candidate.post.createdAt.toISOString(),
    topics: rp.candidate.post.topics,
    author: {
      id: rp.candidate.author.id,
      displayName: rp.candidate.author.displayName,
      avatarUrl: registryUser?.avatarUrl || null,
      affiliations: rp.candidate.author.affiliations,
      verificationLevel: rp.candidate.author.verificationLevel,
      civicReputation: rp.candidate.author.civicReputation,
    },
    thread: rp.candidate.thread
      ? {
          id: rp.candidate.thread.id,
          type: rp.candidate.thread.type,
          topics: rp.candidate.thread.topics,
          participantCount: rp.candidate.thread.participantCount,
          civilityScore: rp.candidate.thread.civilityScore,
          diversityScore: rp.candidate.thread.diversityScore,
        }
      : null,
    sources: rp.candidate.post.sources.map((s: any) => ({
      url: s.url,
      domain: s.domain,
      trustScore: s.trustScore,
    })),
    reactions: {
      agree: rp.candidate.post.agreeCount,
      disagree: rp.candidate.post.disagreeCount,
      insightful: rp.candidate.post.insightfulCount,
      nuance: rp.candidate.post.nuanceCount,
    },
    algorithm: {
      qualityScore: Math.round(rp.qualityScore * 1000) / 1000,
      signals: {
        engagementQuality: Math.round(rp.signals.engagementQuality * 100) / 100,
        civility: Math.round(rp.signals.civility * 100) / 100,
        viewpointDiversity: Math.round(rp.signals.viewpointDiversity * 100) / 100,
        sourceCredibility: Math.round(rp.signals.sourceCredibility * 100) / 100,
        topicRelevance: Math.round(rp.signals.topicRelevance * 100) / 100,
        authorReputation: Math.round(rp.signals.authorReputation * 100) / 100,
        penalty: Math.round(rp.signals.penalty * 100) / 100,
      },
      explanation: rp.explanation,
      explanationTags: rp.explanationTags,
    },
    comment_policy: 'everyone' as const,
    comment_count: (counts.get(rp.candidate.post.id) ?? 0) + mockReplies.filter((r) => r.postId === rp.candidate.post.id).length,
    replies: mockReplies
      .filter((r) => r.postId === rp.candidate.post.id)
      .map((r) => ({
        id: r.id,
        content: r.content,
        author: {
          id: r.author.id,
          displayName: r.author.displayName,
          avatarUrl: null as string | null,
          affiliations: r.author.affiliations,
          verificationLevel: r.author.verificationLevel,
        },
        createdAt: r.createdAt.toISOString(),
        civilityScore: r.civilityScore,
        reactions: {
          agree: r.agreeCount,
          disagree: r.disagreeCount,
          insightful: r.insightfulCount,
        },
      })),
  };
}
