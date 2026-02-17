// ═══════════════════════════════════════════════════════════════
// Civic Social — Simulated New Posts (Live Feed Simulation)
// ═══════════════════════════════════════════════════════════════
//
// Simulates new posts arriving on the platform over time.
// Posts are "released" at staggered intervals after the app starts,
// demonstrating the "New posts available" feature with real data.
//
// In production: Replace with WebSocket push or SSE from the DB.
// ═══════════════════════════════════════════════════════════════

import type { FeedCandidate, AlgoAuthor, AlgoSource } from './algorithm/types';

// ─── Global store (persists across HMR in dev) ─────────────────
const STORE_KEY = Symbol.for('civic.simulated.new.posts');

interface SimStore {
  startTime: number;
}

interface GlobalWithStore {
  [key: symbol]: SimStore | undefined;
}

function getStore(): SimStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { startTime: Date.now() };
  }
  return g[STORE_KEY]!;
}

// ─── Authors (subset, avoids circular dep on mock-data) ─────────
const simAuthors: Record<string, AlgoAuthor> = {
  elena: {
    id: 'user-elena',
    displayName: 'Dr. Elena Rodriguez',
    affiliations: ['center'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.95,
    civilityAvg: 0.97,
    accuracyScore: 0.93,
  },
  sarah: {
    id: 'user-sarah',
    displayName: 'Sarah Chen',
    affiliations: ['center-left'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.92,
    civilityAvg: 0.95,
    accuracyScore: 0.90,
  },
  amara: {
    id: 'user-amara',
    displayName: 'Amara Okafor',
    affiliations: ['left'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.88,
    civilityAvg: 0.91,
    accuracyScore: 0.87,
  },
  marcus: {
    id: 'user-marcus',
    displayName: 'Marcus Johnson',
    affiliations: ['center-right'],
    verificationLevel: 'CITIZEN_VERIFIED',
    civicReputation: 0.78,
    civilityAvg: 0.82,
    accuracyScore: 0.75,
  },
  rachel: {
    id: 'user-rachel',
    displayName: 'Rachel Thompson',
    affiliations: ['center-right'],
    verificationLevel: 'CITIZEN_VERIFIED',
    civicReputation: 0.83,
    civilityAvg: 0.88,
    accuracyScore: 0.80,
  },
  michael: {
    id: 'user-michael',
    displayName: 'Prof. Michael Adler',
    affiliations: ['center'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.96,
    civilityAvg: 0.98,
    accuracyScore: 0.95,
  },
};

// ─── New post templates (released at staggered intervals) ────────
interface NewPostTemplate {
  id: string;
  releaseOffsetMs: number; // ms after app start
  author: AlgoAuthor;
  content: string;
  topics: string[];
  sources: AlgoSource[];
  civility: number;
  toxicity: number;
  solutionOrientation: number;
  empathy: number;
  agreeCount: number;
  disagreeCount: number;
  insightfulCount: number;
  nuanceCount: number;
  replyCount: number;
  substantiveReplies: number;
  threadType: string;
  threadTopics: string[];
  threadCivility: number;
  threadDiversity: number;
  threadEngagement: number;
  threadParticipants: number;
  threadAffiliations: string[];
}

const NEW_POST_TEMPLATES: NewPostTemplate[] = [
  {
    id: 'sim-post-1',
    releaseOffsetMs: 30_000, // 30 seconds
    author: simAuthors.elena,
    content: `Breaking thread on AI regulation — the EU AI Act just passed its final vote, and it has major implications for US tech policy.\n\nKey provisions:\n• Bans real-time biometric surveillance in public spaces\n• Requires transparency for AI-generated content\n• Creates a risk-based classification system (unacceptable → high → limited → minimal)\n\nWhat's interesting: both conservative and progressive policy experts I've spoken to agree on the core transparency requirements — they disagree on enforcement mechanisms.\n\nHere's the full analysis with primary sources from the EU Parliament.`,
    topics: ['technology', 'regulation', 'policy', 'AI'],
    sources: [
      { url: 'https://www.europarl.europa.eu/news/en/press-room/ai-act', domain: 'europarl.europa.eu', trustScore: 0.96, isPrimary: true },
      { url: 'https://www.brookings.edu/articles/the-eu-ai-act/', domain: 'brookings.edu', trustScore: 0.88, isPrimary: false },
    ],
    civility: 0.94,
    toxicity: 0.01,
    solutionOrientation: 0.72,
    empathy: 0.65,
    agreeCount: 87,
    disagreeCount: 9,
    insightfulCount: 71,
    nuanceCount: 29,
    replyCount: 38,
    substantiveReplies: 30,
    threadType: 'NEWS_DISCUSSION',
    threadTopics: ['technology', 'regulation', 'policy', 'AI'],
    threadCivility: 0.88,
    threadDiversity: 0.80,
    threadEngagement: 0.85,
    threadParticipants: 21,
    threadAffiliations: ['center', 'center-left', 'center-right', 'left'],
  },
  {
    id: 'sim-post-2',
    releaseOffsetMs: 65_000, // ~1 minute
    author: simAuthors.sarah,
    content: `New data on housing affordability just dropped and it's worth discussing across the aisle.\n\nThe median home price is now 5.8x the median household income — the highest ratio since 1950. But the causes cut across partisan lines:\n\n• Zoning restrictions (traditionally a local/conservative issue)\n• Insufficient federal investment (traditionally a progressive priority)\n• NIMBYism from BOTH sides of the aisle\n\nI've been researching the "YIMBY" movement that's bringing together libertarians and progressives. It's one of the most promising bipartisan coalitions I've seen.\n\nWhat's happening in your community? Are housing costs affecting you?`,
    topics: ['housing', 'economy', 'policy', 'affordability'],
    sources: [
      { url: 'https://fred.stlouisfed.org/series/MSPUS', domain: 'stlouisfed.org', trustScore: 0.95, isPrimary: true },
      { url: 'https://www.census.gov/housing/', domain: 'census.gov', trustScore: 0.97, isPrimary: true },
    ],
    civility: 0.93,
    toxicity: 0.01,
    solutionOrientation: 0.85,
    empathy: 0.88,
    agreeCount: 105,
    disagreeCount: 14,
    insightfulCount: 58,
    nuanceCount: 42,
    replyCount: 45,
    substantiveReplies: 36,
    threadType: 'CROSS_PARTY_ROUNDTABLE',
    threadTopics: ['housing', 'economy', 'policy'],
    threadCivility: 0.86,
    threadDiversity: 0.85,
    threadEngagement: 0.88,
    threadParticipants: 24,
    threadAffiliations: ['center-left', 'center-right', 'center', 'left', 'right'],
  },
  {
    id: 'sim-post-3',
    releaseOffsetMs: 100_000, // ~1.5 minutes
    author: simAuthors.marcus,
    content: `I want to push back — respectfully — on the narrative that tax cuts always pay for themselves.\n\nAs a fiscal conservative, I believe in low taxes. But intellectual honesty requires acknowledging that the Laffer Curve has limits. The data from the 2017 TCJA shows:\n\n• Corporate tax revenue DID decrease (CBO data)\n• GDP growth was positive but didn't offset the revenue gap\n• The deficit increased\n\nThis doesn't mean tax cuts are bad — it means we need to be more targeted. The EITC expansion, for example, has bipartisan support because it incentivizes work while helping low-income families.\n\nCan we be honest about trade-offs instead of pretending there are none?`,
    topics: ['economy', 'taxation', 'fiscal-policy'],
    sources: [
      { url: 'https://www.cbo.gov/publication/57970', domain: 'cbo.gov', trustScore: 0.97, isPrimary: true },
    ],
    civility: 0.90,
    toxicity: 0.02,
    solutionOrientation: 0.78,
    empathy: 0.72,
    agreeCount: 68,
    disagreeCount: 22,
    insightfulCount: 49,
    nuanceCount: 35,
    replyCount: 32,
    substantiveReplies: 25,
    threadType: 'STRUCTURED_DEBATE',
    threadTopics: ['economy', 'taxation', 'fiscal-policy'],
    threadCivility: 0.82,
    threadDiversity: 0.78,
    threadEngagement: 0.80,
    threadParticipants: 18,
    threadAffiliations: ['center-right', 'center-left', 'right', 'center'],
  },
  {
    id: 'sim-post-4',
    releaseOffsetMs: 150_000, // 2.5 minutes
    author: simAuthors.amara,
    content: `Thread: What happened when our city tried ranked-choice voting — an honest assessment from someone who advocated for it.\n\nThe good:\n✅ Reduced negative campaigning by 40% (candidates needed 2nd-choice votes)\n✅ Third-party candidates got meaningful vote shares for the first time\n✅ Voter satisfaction surveys improved\n\nThe challenges:\n⚠️ 12% of ballots were "exhausted" (voter didn't rank enough candidates)\n⚠️ Results took longer to tabulate\n⚠️ Some voters found it confusing initially\n\nOverall, I still support it — but I think advocates (including me) need to be honest about the learning curve. Electoral reform works best when we address real concerns instead of dismissing them.`,
    topics: ['elections', 'reform', 'democracy', 'voting'],
    sources: [
      { url: 'https://www.fairvote.org/research', domain: 'fairvote.org', trustScore: 0.82, isPrimary: true },
      { url: 'https://electionscience.org/', domain: 'electionscience.org', trustScore: 0.80, isPrimary: false },
    ],
    civility: 0.92,
    toxicity: 0.01,
    solutionOrientation: 0.80,
    empathy: 0.78,
    agreeCount: 92,
    disagreeCount: 16,
    insightfulCount: 55,
    nuanceCount: 38,
    replyCount: 41,
    substantiveReplies: 33,
    threadType: 'POLICY_PROPOSAL',
    threadTopics: ['elections', 'reform', 'democracy'],
    threadCivility: 0.86,
    threadDiversity: 0.82,
    threadEngagement: 0.84,
    threadParticipants: 22,
    threadAffiliations: ['left', 'center-left', 'center', 'center-right'],
  },
  {
    id: 'sim-post-5',
    releaseOffsetMs: 210_000, // 3.5 minutes
    author: simAuthors.rachel,
    content: `As a veteran and mother, here's something that crosses party lines: childcare costs are crushing military families.\n\nI've been talking to service members across all branches, and the numbers are stark:\n• Average childcare cost near a military base: $1,400/month\n• Average E-5 salary: $3,200/month before taxes\n• Wait lists for on-base childcare: 6-18 months\n\nThis isn't a left or right issue — it's a readiness issue. When service members can't find affordable childcare, it affects retention, which affects national defense.\n\nThe bipartisan Military Childcare Act has support from both parties. Let's push for it together.\n\nAny military families here dealing with this? I'd love to hear your stories.`,
    topics: ['military', 'childcare', 'economy', 'family'],
    sources: [
      { url: 'https://www.militaryonesource.mil/family-relationships/parenting-and-children/child-care/', domain: 'militaryonesource.mil', trustScore: 0.93, isPrimary: true },
    ],
    civility: 0.91,
    toxicity: 0.01,
    solutionOrientation: 0.88,
    empathy: 0.92,
    agreeCount: 124,
    disagreeCount: 6,
    insightfulCount: 47,
    nuanceCount: 28,
    replyCount: 36,
    substantiveReplies: 29,
    threadType: 'OPEN_DISCUSSION',
    threadTopics: ['military', 'childcare', 'economy'],
    threadCivility: 0.89,
    threadDiversity: 0.75,
    threadEngagement: 0.82,
    threadParticipants: 19,
    threadAffiliations: ['center-right', 'center-left', 'center', 'right'],
  },
  {
    id: 'sim-post-6',
    releaseOffsetMs: 300_000, // 5 minutes
    author: simAuthors.michael,
    content: `Constitutional law update: The Supreme Court just granted cert in a case that could reshape how we think about free speech online.\n\nThe core question: Do social media platforms have a First Amendment right to moderate content, or are they "common carriers" that must host all legal speech?\n\nThis splits traditional coalitions in fascinating ways:\n• Some conservatives want government regulation of platforms (unusual for the right)\n• Some progressives are defending corporate moderation rights (unusual for the left)\n\nThe originalist and living-constitution frameworks actually both have interesting things to say here. I'm writing a balanced analysis for both perspectives.\n\nWhat do you think: Should platforms be treated like phone companies or newspapers?`,
    topics: ['law', 'technology', 'free-speech', 'constitution'],
    sources: [
      { url: 'https://www.supremecourt.gov/opinions/slipopinion/23', domain: 'supremecourt.gov', trustScore: 0.99, isPrimary: true },
      { url: 'https://www.law.cornell.edu/supct/', domain: 'cornell.edu', trustScore: 0.95, isPrimary: false },
    ],
    civility: 0.96,
    toxicity: 0.0,
    solutionOrientation: 0.60,
    empathy: 0.70,
    agreeCount: 96,
    disagreeCount: 8,
    insightfulCount: 82,
    nuanceCount: 44,
    replyCount: 48,
    substantiveReplies: 40,
    threadType: 'EXPERT_AMA',
    threadTopics: ['law', 'technology', 'free-speech', 'constitution'],
    threadCivility: 0.92,
    threadDiversity: 0.85,
    threadEngagement: 0.90,
    threadParticipants: 26,
    threadAffiliations: ['center', 'center-left', 'center-right', 'right', 'left'],
  },
];

// ─── Build a FeedCandidate from a template ────────────────────
function buildCandidate(template: NewPostTemplate, releaseTime: Date): FeedCandidate {
  return {
    post: {
      id: template.id,
      content: template.content,
      createdAt: releaseTime,
      topics: template.topics,
      civilityScore: template.civility,
      toxicityScore: template.toxicity,
      solutionOrientation: template.solutionOrientation,
      empathyScore: template.empathy,
      avgReadTime: Math.round(template.content.length / 20),
      expectedReadTime: Math.round(template.content.length / 25),
      completionRate: 0.85,
      replyCount: template.replyCount,
      substantiveReplies: template.substantiveReplies,
      sources: template.sources,
      rageBaitScore: 0.01,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: template.agreeCount,
      disagreeCount: template.disagreeCount,
      insightfulCount: template.insightfulCount,
      nuanceCount: template.nuanceCount,
    },
    thread: {
      id: `thread-${template.id}`,
      type: template.threadType,
      topics: template.threadTopics,
      civilityScore: template.threadCivility,
      diversityScore: template.threadDiversity,
      engagementScore: template.threadEngagement,
      participantCount: template.threadParticipants,
      participantAffiliations: template.threadAffiliations,
    },
    author: template.author,
  };
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Returns all simulated new posts that have been "released" so far.
 * Each post's createdAt is set to the moment it was released.
 */
export function getReleasedNewPosts(): FeedCandidate[] {
  const store = getStore();
  const now = Date.now();

  return NEW_POST_TEMPLATES
    .filter((t) => now >= store.startTime + t.releaseOffsetMs)
    .map((t) => {
      const releaseTime = new Date(store.startTime + t.releaseOffsetMs);
      return buildCandidate(t, releaseTime);
    });
}

/**
 * Returns the count of simulated posts released since `sinceTimestamp`.
 * Also includes user-created posts from the post store.
 */
export function getNewPostCountSince(sinceTimestamp: number): {
  count: number;
  latestAt: string | null;
} {
  const store = getStore();
  const now = Date.now();

  const newPosts = NEW_POST_TEMPLATES.filter((t) => {
    const releaseTime = store.startTime + t.releaseOffsetMs;
    return releaseTime <= now && releaseTime > sinceTimestamp;
  });

  if (newPosts.length === 0) {
    return { count: 0, latestAt: null };
  }

  const latestMs = Math.max(
    ...newPosts.map((t) => store.startTime + t.releaseOffsetMs),
  );

  return {
    count: newPosts.length,
    latestAt: new Date(latestMs).toISOString(),
  };
}

/**
 * Returns all released simulated post IDs (for dedup in the feed API).
 */
export function getReleasedPostIds(): Set<string> {
  const store = getStore();
  const now = Date.now();
  const ids = new Set<string>();
  for (const t of NEW_POST_TEMPLATES) {
    if (now >= store.startTime + t.releaseOffsetMs) {
      ids.add(t.id);
    }
  }
  return ids;
}
