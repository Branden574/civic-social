// ═══════════════════════════════════════════════════════════════
// Civic Social — Comprehensive Mock Data
// ═══════════════════════════════════════════════════════════════
//
// This data is designed to demonstrate the For You algorithm.
// Each post is crafted with specific signal profiles:
//
//   🟢 HIGH-rank posts: civil, sourced, cross-party, solution-oriented
//   🔴 LOW-rank posts:  rage-bait, unsourced, toxic, low-effort
//
// The algorithm should consistently rank greens above reds.
// ═══════════════════════════════════════════════════════════════

import type {
  AlgoUser,
  FeedCandidate,
  AlgoPost,
  AlgoThread,
  AlgoAuthor,
  AlgoSource,
} from '../algorithm/types';

// ─── Mock Users ──────────────────────────────────────────────

export const mockUsers: Record<string, AlgoUser> = {
  current: {
    id: 'user-current',
    affiliations: ['center-left'],
    topicInterests: ['healthcare', 'economy', 'climate', 'education'],
    followingIds: ['user-sarah', 'user-elena', 'user-david', 'user-michael', 'user-amara', 'user-rachel', 'user-marcus'],
    civicReputation: 0.7,
    civilityAvg: 0.8,
    country: 'US',
  },
};

// ─── Mock Authors ────────────────────────────────────────────

const authors: Record<string, AlgoAuthor> = {
  sarah: {
    id: 'user-sarah',
    displayName: 'Sarah Chen',
    affiliations: ['center-left'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.92,
    civilityAvg: 0.95,
    accuracyScore: 0.90,
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
  elena: {
    id: 'user-elena',
    displayName: 'Dr. Elena Rodriguez',
    affiliations: ['center'],
    verificationLevel: 'EXPERT_VERIFIED',
    civicReputation: 0.95,
    civilityAvg: 0.97,
    accuracyScore: 0.93,
  },
  james: {
    id: 'user-james',
    displayName: 'James O\'Brien',
    affiliations: ['right'],
    verificationLevel: 'EMAIL_VERIFIED',
    civicReputation: 0.45,
    civilityAvg: 0.40,
    accuracyScore: 0.35,
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
  david: {
    id: 'user-david',
    displayName: 'David Kim',
    affiliations: ['center-left'],
    verificationLevel: 'CITIZEN_VERIFIED',
    civicReputation: 0.72,
    civilityAvg: 0.80,
    accuracyScore: 0.70,
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
  troll: {
    id: 'user-troll',
    displayName: 'PatriotEagle2024',
    affiliations: ['right'],
    verificationLevel: 'UNVERIFIED',
    civicReputation: 0.10,
    civilityAvg: 0.15,
    accuracyScore: 0.10,
  },
  bot: {
    id: 'user-bot',
    displayName: 'NewsFlash_Updates',
    affiliations: ['center'],
    verificationLevel: 'UNVERIFIED',
    civicReputation: 0.05,
    civilityAvg: 0.30,
    accuracyScore: 0.05,
  },
};

// ─── Helper ──────────────────────────────────────────────────

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ─── Mock Posts ──────────────────────────────────────────────
// Each post has carefully tuned signal values to demonstrate
// the algorithm's ranking behavior.

export const mockCandidates: FeedCandidate[] = [
  // ────────────────────────────────────────────────────────
  // 🟢 POST 1: HIGH RANK — Cross-party healthcare debate
  //    Civil, sourced, cross-party, solution-oriented
  //    Expected rank: #1-2
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-1',
      content: `I've been studying healthcare systems across 12 OECD nations, and the data suggests a hybrid model could work for the US. Countries like Germany and Switzerland use regulated private insurers with a public safety net — achieving universal coverage while maintaining competition.\n\nKey findings:\n• Germany spends 11.7% of GDP on healthcare vs US at 17.8%\n• Patient satisfaction in hybrid systems averages 78% vs 56% in the US\n• Wait times are comparable to pure private systems\n\nI believe both sides have valid concerns: the left is right about coverage gaps, and the right is right about efficiency concerns. A hybrid model addresses both.\n\nWhat do you think — could a German-style system work here?`,
      createdAt: hoursAgo(14),
      topics: ['healthcare', 'policy', 'economy'],
      civilityScore: 0.95,
      toxicityScore: 0.02,
      solutionOrientation: 0.92,
      empathyScore: 0.85,
      avgReadTime: 45,
      expectedReadTime: 35,
      completionRate: 0.88,
      replyCount: 47,
      substantiveReplies: 38,
      sources: [
        { url: 'https://data.oecd.org/healthres/health-spending.htm', domain: 'oecd.org', trustScore: 0.95, isPrimary: true },
        { url: 'https://www.commonwealthfund.org/publications/fund-reports/2024/mirror-mirror', domain: 'commonwealthfund.org', trustScore: 0.90, isPrimary: false },
        { url: 'https://www.who.int/data/gho', domain: 'who.int', trustScore: 0.95, isPrimary: true },
      ],
      rageBaitScore: 0.01,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 89,
      disagreeCount: 12,
      insightfulCount: 67,
      nuanceCount: 34,
    },
    thread: {
      id: 'thread-1',
      type: 'POLICY_PROPOSAL',
      topics: ['healthcare', 'policy', 'economy'],
      civilityScore: 0.88,
      diversityScore: 0.85,
      engagementScore: 0.90,
      participantCount: 23,
      participantAffiliations: ['center-left', 'center-right', 'center', 'left', 'right'],
    },
    author: authors.sarah,
  },

  // ────────────────────────────────────────────────────────
  // 🟢 POST 2: HIGH RANK — Expert constitutional analysis
  //    Scholarly, multi-perspective, deeply civil
  //    Expected rank: #2-3
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-2',
      content: `Constitutional question: Can executive orders on immigration withstand judicial review?\n\nAfter analyzing 40+ years of precedent, the answer is nuanced. The President has broad authority under the INA, but the Supreme Court has consistently held that due process applies regardless of citizenship status (Zadvydas v. Davis, 2001).\n\nBoth originalist and living-constitution scholars actually agree on more than you'd think here. The disagreement is primarily about scope, not principle.\n\nI've compiled a non-partisan legal analysis thread. Perspectives from both Federalist Society and ACS scholars included.`,
      createdAt: hoursAgo(18),
      topics: ['law', 'immigration', 'constitution'],
      civilityScore: 0.98,
      toxicityScore: 0.0,
      solutionOrientation: 0.65,
      empathyScore: 0.80,
      avgReadTime: 60,
      expectedReadTime: 40,
      completionRate: 0.92,
      replyCount: 35,
      substantiveReplies: 31,
      sources: [
        { url: 'https://supreme.justia.com/cases/federal/us/533/678/', domain: 'justia.com', trustScore: 0.85, isPrimary: true },
        { url: 'https://www.law.cornell.edu/uscode/text/8', domain: 'cornell.edu', trustScore: 0.95, isPrimary: true },
      ],
      rageBaitScore: 0.0,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 72,
      disagreeCount: 5,
      insightfulCount: 93,
      nuanceCount: 41,
    },
    thread: {
      id: 'thread-2',
      type: 'EXPERT_AMA',
      topics: ['law', 'immigration', 'constitution'],
      civilityScore: 0.95,
      diversityScore: 0.78,
      engagementScore: 0.88,
      participantCount: 18,
      participantAffiliations: ['center', 'center-left', 'center-right', 'right'],
    },
    author: authors.michael,
  },

  // ────────────────────────────────────────────────────────
  // 🟢 POST 3: HIGH RANK — Climate policy cross-party bridge
  //    Solution-focused, acknowledges trade-offs
  //    Expected rank: #3-4
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-3',
      content: `I'm an environmental scientist, and I want to have an honest conversation about climate policy trade-offs.\n\nThe climate crisis is real and urgent. But I also understand the economic concerns from communities that depend on fossil fuel industries. Both things can be true.\n\nHere's what the data shows about transition programs that actually work:\n\n1. Retraining programs with 70%+ job placement (see Appalachian model)\n2. Gradual phase-outs that give communities 10-15 year runways\n3. Clean energy tax incentives that create 3x more jobs per dollar\n\nWe don't have to choose between planet and people. The evidence shows we can do both — but only if we listen to affected communities, not just activists or lobbyists.`,
      createdAt: hoursAgo(22),
      topics: ['climate', 'economy', 'energy', 'jobs'],
      civilityScore: 0.93,
      toxicityScore: 0.01,
      solutionOrientation: 0.95,
      empathyScore: 0.92,
      avgReadTime: 52,
      expectedReadTime: 38,
      completionRate: 0.85,
      replyCount: 62,
      substantiveReplies: 48,
      sources: [
        { url: 'https://www.iea.org/reports/world-energy-outlook-2024', domain: 'iea.org', trustScore: 0.92, isPrimary: true },
        { url: 'https://www.bls.gov/oes/current/naics4_221100.htm', domain: 'bls.gov', trustScore: 0.95, isPrimary: true },
      ],
      rageBaitScore: 0.02,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 156,
      disagreeCount: 18,
      insightfulCount: 89,
      nuanceCount: 67,
    },
    thread: {
      id: 'thread-3',
      type: 'CROSS_PARTY_ROUNDTABLE',
      topics: ['climate', 'economy', 'energy', 'jobs'],
      civilityScore: 0.85,
      diversityScore: 0.90,
      engagementScore: 0.92,
      participantCount: 31,
      participantAffiliations: ['left', 'center-left', 'center', 'center-right', 'right'],
    },
    author: authors.amara,
  },

  // ────────────────────────────────────────────────────────
  // 🟢 POST 4: HIGH RANK — Veteran affairs bipartisan thread
  //    Personal experience + data, constructive disagreement
  //    Expected rank: #4-5
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-4',
      content: `As a veteran, I've seen the VA system from the inside. It's not the disaster some portray, but it's not perfect either.\n\nHere's what I think both parties get right:\n\nDemocrats: The VA needs MORE funding, not less. The suicide prevention programs alone have saved thousands of lives.\n\nRepublicans: Veterans should have the CHOICE to use private healthcare when VA wait times are unacceptable.\n\nMy proposal: Keep the VA as a strong core system, but expand the MISSION Act to give veterans more flexibility. Both principles — strong public services AND personal choice — can coexist.\n\nWho else has experience with the VA system? I'd love to hear from veterans across the political spectrum.`,
      createdAt: hoursAgo(26),
      topics: ['veterans', 'healthcare', 'military'],
      civilityScore: 0.91,
      toxicityScore: 0.01,
      solutionOrientation: 0.88,
      empathyScore: 0.90,
      avgReadTime: 40,
      expectedReadTime: 32,
      completionRate: 0.82,
      replyCount: 43,
      substantiveReplies: 35,
      sources: [
        { url: 'https://www.va.gov/health/ves/', domain: 'va.gov', trustScore: 0.95, isPrimary: true },
      ],
      rageBaitScore: 0.01,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 112,
      disagreeCount: 8,
      insightfulCount: 54,
      nuanceCount: 38,
    },
    thread: {
      id: 'thread-4',
      type: 'OPEN_DISCUSSION',
      topics: ['veterans', 'healthcare', 'military'],
      civilityScore: 0.87,
      diversityScore: 0.82,
      engagementScore: 0.85,
      participantCount: 22,
      participantAffiliations: ['center-right', 'center-left', 'right', 'center'],
    },
    author: authors.rachel,
  },

  // ────────────────────────────────────────────────────────
  // 🟡 POST 5: MEDIUM RANK — Decent content but unsourced
  //    Polite opinion, no sources, limited engagement
  //    Expected rank: middle
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-5',
      content: `I think we need to have a serious conversation about education funding in this country. Teachers are underpaid, schools are falling apart, and our kids are falling behind. Something has to change.\n\nNot sure what the right approach is, but I know the status quo isn't working.`,
      createdAt: hoursAgo(1),
      topics: ['education', 'economy'],
      civilityScore: 0.75,
      toxicityScore: 0.05,
      solutionOrientation: 0.20,
      empathyScore: 0.50,
      avgReadTime: 12,
      expectedReadTime: 15,
      completionRate: 0.70,
      replyCount: 15,
      substantiveReplies: 6,
      sources: [],
      rageBaitScore: 0.05,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 34,
      disagreeCount: 3,
      insightfulCount: 5,
      nuanceCount: 2,
    },
    thread: {
      id: 'thread-5',
      type: 'OPEN_DISCUSSION',
      topics: ['education', 'economy'],
      civilityScore: 0.72,
      diversityScore: 0.40,
      engagementScore: 0.45,
      participantCount: 8,
      participantAffiliations: ['center-left', 'center'],
    },
    author: authors.david,
  },

  // ────────────────────────────────────────────────────────
  // 🟡 POST 6: MEDIUM RANK — Good debate reply from right
  //    Respectful disagreement with some substance
  //    Expected rank: middle-high
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-6',
      content: `I respectfully disagree with the premise that more government spending is the solution to our economic challenges. As a small business owner, I've seen firsthand how regulations can stifle innovation.\n\nHowever, I do agree that we need a better safety net — just one that's more targeted and efficient. The Earned Income Tax Credit is a great example of a program that both sides can support.\n\nCan we find more areas of agreement like EITC? I think there are more than people realize.`,
      createdAt: hoursAgo(8),
      topics: ['economy', 'taxation', 'regulation'],
      civilityScore: 0.86,
      toxicityScore: 0.03,
      solutionOrientation: 0.70,
      empathyScore: 0.72,
      avgReadTime: 30,
      expectedReadTime: 25,
      completionRate: 0.78,
      replyCount: 28,
      substantiveReplies: 20,
      sources: [
        { url: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc', domain: 'irs.gov', trustScore: 0.95, isPrimary: false },
      ],
      rageBaitScore: 0.03,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 45,
      disagreeCount: 15,
      insightfulCount: 28,
      nuanceCount: 22,
    },
    thread: {
      id: 'thread-6',
      type: 'STRUCTURED_DEBATE',
      topics: ['economy', 'taxation', 'regulation'],
      civilityScore: 0.80,
      diversityScore: 0.75,
      engagementScore: 0.72,
      participantCount: 15,
      participantAffiliations: ['center-right', 'center-left', 'right'],
    },
    author: authors.marcus,
  },

  // ────────────────────────────────────────────────────────
  // 🟢 POST 7: HIGH RANK — News discussion with fact-check
  //    Balanced analysis of breaking news
  //    Expected rank: high
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-7',
      content: `Thread on the new bipartisan infrastructure bill — separating fact from spin:\n\n✅ VERIFIED: The bill allocates $110B for roads and bridges\n✅ VERIFIED: Includes $65B for broadband expansion\n⚠️ DISPUTED: Claims of "no new taxes" — the CBO score shows revenue offsets\n❌ FALSE: It does NOT include a "mileage tax" (this is a misreading of a pilot study provision)\n\nBoth parties are cherry-picking. Here's the full CBO analysis for anyone who wants to read the primary source.\n\nLet's discuss the actual policy merits, not the talking points.`,
      createdAt: hoursAgo(3),
      topics: ['infrastructure', 'economy', 'legislation'],
      civilityScore: 0.92,
      toxicityScore: 0.01,
      solutionOrientation: 0.55,
      empathyScore: 0.60,
      avgReadTime: 38,
      expectedReadTime: 30,
      completionRate: 0.90,
      replyCount: 55,
      substantiveReplies: 42,
      sources: [
        { url: 'https://www.cbo.gov/publication/57327', domain: 'cbo.gov', trustScore: 0.97, isPrimary: true },
        { url: 'https://www.congress.gov/bill/118th-congress', domain: 'congress.gov', trustScore: 0.98, isPrimary: true },
        { url: 'https://apnews.com/article/infrastructure-bill-fact-check', domain: 'apnews.com', trustScore: 0.88, isPrimary: false },
      ],
      rageBaitScore: 0.01,
      allCapsRatio: 0.02,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 134,
      disagreeCount: 11,
      insightfulCount: 98,
      nuanceCount: 45,
    },
    thread: {
      id: 'thread-7',
      type: 'NEWS_DISCUSSION',
      topics: ['infrastructure', 'economy', 'legislation'],
      civilityScore: 0.85,
      diversityScore: 0.82,
      engagementScore: 0.88,
      participantCount: 27,
      participantAffiliations: ['center-left', 'center-right', 'center', 'left'],
    },
    author: authors.elena,
  },

  // ────────────────────────────────────────────────────────
  // 🔴 POST 8: LOW RANK — Pure rage-bait
  //    All caps, no sources, toxic, no solutions
  //    Expected rank: very low (algorithm should demote this)
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-8',
      content: `WAKE UP PEOPLE!!! The other side is LITERALLY DESTROYING this country!!! They don't care about YOU or YOUR FAMILY!!! When are we going to FIGHT BACK?!?! SHARE THIS BEFORE THEY DELETE IT!!!`,
      createdAt: hoursAgo(1),
      topics: ['politics'],
      civilityScore: 0.08,
      toxicityScore: 0.88,
      solutionOrientation: 0.0,
      empathyScore: 0.02,
      avgReadTime: 5,
      expectedReadTime: 8,
      completionRate: 0.95,
      replyCount: 89,
      substantiveReplies: 4,
      sources: [],
      rageBaitScore: 0.95,
      allCapsRatio: 0.72,
      botLikelihood: 0.15,
      flagCount: 12,
      agreeCount: 234,
      disagreeCount: 156,
      insightfulCount: 1,
      nuanceCount: 0,
    },
    thread: {
      id: 'thread-8',
      type: 'OPEN_DISCUSSION',
      topics: ['politics'],
      civilityScore: 0.15,
      diversityScore: 0.10,
      engagementScore: 0.30,
      participantCount: 45,
      participantAffiliations: ['right'],
    },
    author: authors.troll,
  },

  // ────────────────────────────────────────────────────────
  // 🔴 POST 9: LOW RANK — Bot-like spam
  //    Suspicious patterns, no substance
  //    Expected rank: filtered or very low
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-9',
      content: `Breaking: New poll shows shocking results that will change everything. Click here to see what they don't want you to know. This changes everything about the upcoming election.`,
      createdAt: hoursAgo(0.5),
      topics: ['elections'],
      civilityScore: 0.30,
      toxicityScore: 0.20,
      solutionOrientation: 0.0,
      empathyScore: 0.0,
      avgReadTime: 3,
      expectedReadTime: 8,
      completionRate: 0.40,
      replyCount: 5,
      substantiveReplies: 0,
      sources: [],
      rageBaitScore: 0.80,
      allCapsRatio: 0.05,
      botLikelihood: 0.85,
      flagCount: 8,
      agreeCount: 12,
      disagreeCount: 45,
      insightfulCount: 0,
      nuanceCount: 0,
    },
    author: authors.bot,
  },

  // ────────────────────────────────────────────────────────
  // 🔴 POST 10: LOW RANK — Low-effort meme post
  //    Short, no substance, no sources
  //    Expected rank: low
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-10',
      content: `lol the other side is so dumb`,
      createdAt: hoursAgo(2),
      topics: ['politics'],
      civilityScore: 0.15,
      toxicityScore: 0.55,
      solutionOrientation: 0.0,
      empathyScore: 0.0,
      avgReadTime: 2,
      expectedReadTime: 2,
      completionRate: 1.0,
      replyCount: 8,
      substantiveReplies: 0,
      sources: [],
      rageBaitScore: 0.40,
      allCapsRatio: 0.0,
      botLikelihood: 0.10,
      flagCount: 3,
      agreeCount: 15,
      disagreeCount: 22,
      insightfulCount: 0,
      nuanceCount: 0,
    },
    author: authors.james,
  },

  // ────────────────────────────────────────────────────────
  // 🟢 POST 11: HIGH RANK — Education policy with data
  //    Expected rank: high
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-11',
      content: `New research on school choice programs — and the results are more nuanced than either side admits.\n\nA 10-year longitudinal study across 8 states shows:\n• Charter schools outperform in urban areas by 8-12% on math scores\n• Traditional public schools outperform in suburban/rural areas\n• Voucher programs show mixed results — depends heavily on implementation\n\nThe takeaway? Context matters enormously. Instead of ideological all-or-nothing positions, we should be asking: "What works best for THIS community?"\n\nI've attached the full study. Would love to hear from educators on both sides.`,
      createdAt: hoursAgo(36),
      topics: ['education', 'policy', 'research'],
      civilityScore: 0.94,
      toxicityScore: 0.0,
      solutionOrientation: 0.82,
      empathyScore: 0.75,
      avgReadTime: 48,
      expectedReadTime: 35,
      completionRate: 0.86,
      replyCount: 38,
      substantiveReplies: 30,
      sources: [
        { url: 'https://nces.ed.gov/pubsearch/', domain: 'ed.gov', trustScore: 0.93, isPrimary: true },
        { url: 'https://www.brookings.edu/topic/education/', domain: 'brookings.edu', trustScore: 0.88, isPrimary: false },
      ],
      rageBaitScore: 0.0,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 0,
      agreeCount: 78,
      disagreeCount: 9,
      insightfulCount: 62,
      nuanceCount: 35,
    },
    thread: {
      id: 'thread-11',
      type: 'POLICY_PROPOSAL',
      topics: ['education', 'policy', 'research'],
      civilityScore: 0.90,
      diversityScore: 0.80,
      engagementScore: 0.85,
      participantCount: 19,
      participantAffiliations: ['center', 'center-left', 'center-right', 'left'],
    },
    author: authors.elena,
  },

  // ────────────────────────────────────────────────────────
  // 🟡 POST 12: MEDIUM — Personal story, emotive, light sources
  //    Expected rank: medium
  // ────────────────────────────────────────────────────────
  {
    post: {
      id: 'post-12',
      content: `As a public defender, I see the criminal justice system's failures every single day. My clients — mostly poor, mostly minorities — face a system that's stacked against them from day one.\n\nBut I also work with prosecutors who genuinely care about justice. The problem isn't evil people — it's a broken system.\n\nI'd love to see more conservatives engage with criminal justice reform. This used to be a bipartisan issue (remember the First Step Act?). What happened?`,
      createdAt: hoursAgo(48),
      topics: ['criminal-justice', 'reform', 'equity'],
      civilityScore: 0.82,
      toxicityScore: 0.05,
      solutionOrientation: 0.55,
      empathyScore: 0.88,
      avgReadTime: 28,
      expectedReadTime: 25,
      completionRate: 0.75,
      replyCount: 24,
      substantiveReplies: 16,
      sources: [],
      rageBaitScore: 0.08,
      allCapsRatio: 0.0,
      botLikelihood: 0.0,
      flagCount: 1,
      agreeCount: 56,
      disagreeCount: 7,
      insightfulCount: 32,
      nuanceCount: 18,
    },
    thread: {
      id: 'thread-12',
      type: 'OPEN_DISCUSSION',
      topics: ['criminal-justice', 'reform', 'equity'],
      civilityScore: 0.78,
      diversityScore: 0.55,
      engagementScore: 0.65,
      participantCount: 12,
      participantAffiliations: ['center-left', 'center', 'left'],
    },
    author: authors.david,
  },
];

// ─── Mock News Articles ──────────────────────────────────────

export interface MockNewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceDomain: string;
  publishedAt: Date;
  imageUrl?: string;
  topics: string[];
  factCheckStatus: 'VERIFIED' | 'UNCHECKED' | 'DISPUTED' | 'PARTIALLY_TRUE';
  sourceTrustScore: number;
  discussionCount: number;
}

export const mockNewsArticles: MockNewsArticle[] = [
  {
    id: 'news-1',
    title: 'Bipartisan Infrastructure Bill Passes Senate with 69-30 Vote',
    summary: 'The Senate passed a $1.2 trillion infrastructure package with bipartisan support, allocating funds for roads, bridges, broadband, and clean energy. The bill now moves to the House where its fate is less certain.',
    url: 'https://apnews.com/hub/infrastructure',
    source: 'Associated Press',
    sourceDomain: 'apnews.com',
    publishedAt: hoursAgo(4),
    topics: ['infrastructure', 'legislation', 'economy'],
    factCheckStatus: 'VERIFIED',
    sourceTrustScore: 0.92,
    discussionCount: 0,
  },
  {
    id: 'news-2',
    title: 'Supreme Court to Hear Major Case on Executive Power Limits',
    summary: 'The Supreme Court agreed to hear a case that could redefine the scope of presidential authority over federal agencies, with implications for regulatory policy across multiple sectors.',
    url: 'https://www.reuters.com/legal/government',
    source: 'Reuters',
    sourceDomain: 'reuters.com',
    publishedAt: hoursAgo(6),
    topics: ['law', 'supreme-court', 'executive-power'],
    factCheckStatus: 'VERIFIED',
    sourceTrustScore: 0.94,
    discussionCount: 0,
  },
  {
    id: 'news-3',
    title: 'New Study: Climate Migration Could Displace 200 Million by 2050',
    summary: 'A comprehensive World Bank study projects that climate change could force up to 216 million people to migrate within their own countries by 2050, with Sub-Saharan Africa and South Asia most affected.',
    url: 'https://www.bbc.com/news/science-environment',
    source: 'World Bank / BBC',
    sourceDomain: 'bbc.com',
    publishedAt: hoursAgo(8),
    topics: ['climate', 'migration', 'global'],
    factCheckStatus: 'VERIFIED',
    sourceTrustScore: 0.90,
    discussionCount: 0,
  },
  {
    id: 'news-4',
    title: 'State-Level Universal Basic Income Pilot Shows Mixed Results',
    summary: 'A two-year UBI pilot in a mid-sized U.S. city found that recipients reported improved mental health and food security, but employment rates remained unchanged — contradicting both supporters\' and critics\' predictions.',
    url: 'https://www.npr.org/sections/economy',
    source: 'NPR',
    sourceDomain: 'npr.org',
    publishedAt: hoursAgo(10),
    topics: ['economy', 'welfare', 'policy', 'research'],
    factCheckStatus: 'VERIFIED',
    sourceTrustScore: 0.88,
    discussionCount: 0,
  },
  {
    id: 'news-5',
    title: 'Voter Turnout Hits Record High in Municipal Elections',
    summary: 'Municipal elections across 15 major cities saw record voter turnout, driven by new civic engagement apps and same-day voter registration. Analysts credit increased awareness of local government\'s impact on daily life.',
    url: 'https://apnews.com/hub/elections',
    source: 'Associated Press',
    sourceDomain: 'apnews.com',
    publishedAt: hoursAgo(14),
    topics: ['elections', 'civic-engagement', 'local-government'],
    factCheckStatus: 'VERIFIED',
    sourceTrustScore: 0.87,
    discussionCount: 0,
  },
];

// ─── Mock Replies (for thread expansion) ─────────────────────

export interface MockReply {
  id: string;
  postId: string;
  content: string;
  author: AlgoAuthor;
  createdAt: Date;
  civilityScore: number;
  agreeCount: number;
  disagreeCount: number;
  insightfulCount: number;
}

export const mockReplies: MockReply[] = [
  {
    id: 'reply-1a',
    postId: 'post-1',
    content: 'Great analysis, Sarah. As someone who leans conservative, I actually find the German model compelling. My concern is the transition period — how do we get from here to there without disrupting coverage for 150M+ people?',
    author: authors.marcus,
    createdAt: hoursAgo(13),
    civilityScore: 0.90,
    agreeCount: 34,
    disagreeCount: 2,
    insightfulCount: 28,
  },
  {
    id: 'reply-1b',
    postId: 'post-1',
    content: 'The transition question is key. Switzerland did a phased approach over 5 years. I\'ve compiled a timeline of how they managed it — including the political compromises both sides had to make.',
    author: authors.elena,
    createdAt: hoursAgo(12.5),
    civilityScore: 0.95,
    agreeCount: 41,
    disagreeCount: 1,
    insightfulCount: 38,
  },
  {
    id: 'reply-1c',
    postId: 'post-1',
    content: 'I appreciate the data-driven approach. One thing I\'d add: we should also look at Singapore\'s model. They spend only 4.1% of GDP on healthcare with excellent outcomes. Very different approach — more individual savings-based.',
    author: authors.rachel,
    createdAt: hoursAgo(12),
    civilityScore: 0.88,
    agreeCount: 22,
    disagreeCount: 5,
    insightfulCount: 19,
  },
  {
    id: 'reply-3a',
    postId: 'post-3',
    content: 'Thank you for acknowledging the economic concerns. In my community, the coal plant closure devastated us. But the solar farm that replaced it actually created more jobs — it just took 3 painful years of transition.',
    author: authors.marcus,
    createdAt: hoursAgo(21),
    civilityScore: 0.92,
    agreeCount: 67,
    disagreeCount: 1,
    insightfulCount: 45,
  },
  {
    id: 'reply-3b',
    postId: 'post-3',
    content: 'The 3x jobs per dollar figure for clean energy tax incentives is consistent with what we\'ve found in our research. Here\'s the DOE analysis that supports this.',
    author: authors.michael,
    createdAt: hoursAgo(20.5),
    civilityScore: 0.96,
    agreeCount: 52,
    disagreeCount: 0,
    insightfulCount: 48,
  },
];
