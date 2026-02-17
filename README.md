# Civic Social — The Civic Discourse Platform

A next-generation political social media platform purpose-built for civil discourse, evidence-based debate, and solution-driven civic engagement.

**Core Principle:** Civility is rewarded. Outrage is demoted. Truth is prioritized.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

### For You Algorithm — Deep Dive

The ranking engine is the platform's most critical component. Unlike traditional social platforms that optimize for engagement volume (which rewards outrage), Civic Social optimizes for **engagement quality**.

#### Quality Score Formula

```
Q(post, user) = Σ(wᵢ × Sᵢ) − P × penaltyMultiplier
```

Where signals `Sᵢ` and weights `wᵢ` are:

| Signal | Weight | What it Measures |
|---|---|---|
| **Civility** | **0.25** | Tone quality, empathy, solution orientation |
| Engagement Quality | 0.20 | Read time, completion rate, substantive replies |
| Viewpoint Diversity | 0.15 | Cross-party engagement, perspective breadth |
| Source Credibility | 0.15 | Number and quality of cited sources |
| Topic Relevance | 0.15 | Match to user interests, recency, trending |
| Author Reputation | 0.10 | Verification level, historical civility, accuracy |
| **Penalty** | **subtracted** | Rage-bait, bot likelihood, flags, low-effort |

**Key Design Choice:** Civility has the highest weight (0.25), making it the single most important factor in ranking. A rage-bait post with massive engagement will always rank below a civil, well-sourced post with moderate engagement.

#### Signal Computation

Each signal is computed as a weighted sub-formula. See `src/lib/algorithm/signals.ts` for full math:

**Engagement Quality:**
```
E = 0.30·readTimeRatio + 0.25·completionRate + 0.30·substantiveReplyRatio + 0.15·replyDepth
```

**Civility:**
```
C = 0.30·(1−toxicity) + 0.25·politeness + 0.20·empathy + 0.25·solutionOrientation
```

**Viewpoint Diversity:**
```
D = 0.40·crossPartyScore + 0.35·affiliationDistance + 0.25·topicNovelty
```

**Source Credibility:**
```
S = 0.30·sourceCount + 0.50·avgTrustScore + 0.20·hasPrimarySource
```

**Penalty (subtracted):**
```
P = 0.30·rageBait + 0.15·capsRatio + 0.20·flagPenalty + 0.20·botLikelihood + 0.15·lowEffort
```

#### Diversity-Aware Re-Ranking

After scoring, a modified **Maximal Marginal Relevance (MMR)** algorithm re-ranks the feed:

1. Sliding window of 5 posts
2. No more than 60% from the same political affiliation
3. At least 1 cross-party thread per window
4. Thread type mixing enforced (no 4 debates in a row)

This ensures the feed is never an echo chamber, even for highly partisan users.

### Data Schema

Full Prisma schema in `prisma/schema.prisma` covering:

- **Users** — identity, verification tiers, reputation metrics
- **Political Parties** — per-country official party registry
- **Threads** — 6 types (Open, Structured Debate, Policy Proposal, Cross-Party Roundtable, Expert AMA, News Discussion)
- **Posts** — content + AI-scored signals (civility, toxicity, solution orientation, empathy)
- **Sources** — cited links with trust scores
- **Reactions** — nuanced (Agree, Disagree, Insightful, Add Nuance, Bookmark, Share)
- **Read Events** — engagement tracking for algorithm training
- **News Articles** — AI summaries, fact-check status, source trust
- **Moderation** — reports, automated actions, transparency

### Platform Sections

| Section | Description |
|---|---|
| **For You** | Algorithmic feed prioritizing quality, civility, and diversity |
| **Following** | Chronological posts from followed users |
| **Civic News** | Verified outlets with AI summaries and fact-check badges |
| **Policy Labs** | Collaborative policy proposals with cross-party refinement |
| **Debate Rooms** | Structured debates with timed stages and civility meters |
| **Live Events** | Hearings, elections, town halls with companion threads |
| **Profile** | Civic reputation, earned badges, privacy controls |
| **Registration** | Country + party selection with transparency-first onboarding |

### Privacy Architecture

- End-to-end encrypted DMs
- Zero third-party data selling
- No ad tracking
- 1-click data deletion
- GDPR / CCPA / SOC 2 / ISO 27001 design
- Minimal data collection policy

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database Schema:** Prisma (PostgreSQL)
- **Icons:** Lucide React
- **Algorithm:** Custom TypeScript ranking engine

## Project Structure

```
src/
├── app/                    # Next.js pages
│   ├── page.tsx            # Feed (home)
│   ├── news/               # Civic News
│   ├── labs/               # Policy Labs
│   ├── debates/            # Debate Rooms
│   ├── live/               # Live Events
│   ├── profile/            # User Profile
│   ├── register/           # Registration flow
│   ├── settings/           # Settings
│   └── api/feed/           # Feed API endpoint
├── components/
│   ├── layout/sidebar.tsx  # Navigation (desktop + mobile)
│   └── feed/               # Post cards, feed view
├── lib/
│   ├── algorithm/          # ← THE CORE ENGINE
│   │   ├── types.ts        # Type definitions + config
│   │   ├── signals.ts      # Signal computation (6 signals + penalty)
│   │   ├── scoring.ts      # Composite scoring + explanation generator
│   │   ├── diversity.ts    # Diversity-aware re-ranking (MMR)
│   │   └── index.ts        # Pipeline entry point
│   └── data/
│       ├── mock-data.ts    # 12 demo posts with tuned signals
│       └── countries.ts    # Country + party registry
└── prisma/
    └── schema.prisma       # Full database schema
```

## License

Proprietary. All rights reserved.
