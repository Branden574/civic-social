# X-Algorithm Port v1 — Design

**Status:** Implemented (behind `FEATURE_X_ENGINE` flag)
**Date:** 2026-05-22
**Scope target:** ~1M posts / ~100K users
**Mission constraint:** Preserve civility-weighted ranking objective

## Motivation

ARCHITECTURE.md lines 749–779 names five weaknesses in the current ranking engine that map almost perfectly onto patterns X (Twitter) solved:

| Stated weakness | X pattern that solves it |
|---|---|
| "Feed algorithm is O(n) — scores every published post" | Candidate generation with quotas, cap ~1,500 |
| "Mute filters: UI exists in settings but not persisted or enforced in feed" | Viewer-aware visibility filter |
| No out-of-network discovery | Topic-match + trending sources |
| No viewer↔author affinity signal | Real-Graph affinity (mat-view backed) |
| "No pagination cursor in feed API" | Opaque base64 cursor at API edge |
| Single-pass scoring of every candidate | Light ranker (1500→200) → Heavy ranker |

**What we did NOT port:** engagement-prediction objectives (predicted like/retweet/reply probabilities). Those would conflict with the platform's mission. The civility-weighted Q-score is unchanged.

## Pipeline

```
viewer ─► generateCandidates  ──── Prisma + matviews, 4 sources, ≤1,500
              │
              ▼
         filterVisibility ────── safety + deletes + mutes + blocks + self
              │
              ▼
         lightRank ─────────────── 4 cheap signals, narrow 1,500 → 200
              │
              ▼
         scoreCandidates ─────── existing 6-signal Q-score + Real-Graph (7th)
              │
              ▼
         diversityRerank ─────── existing MMR rerank (unchanged)
              │
              ▼
       cursor-paginated feed
```

## Section-by-section decisions

### §1 — Candidate generation ([candidates.ts](../../../src/lib/algorithm/candidates.ts))

Four sources, parallel-fetched via `Promise.all`, deduped (in-network wins ties).

| Source | Quota | Window | Index used |
|---|---|---|---|
| in-network | 750 | 7 d | `StoredPost_author_published_createdAt_idx` |
| out-of-network-topic | 500 | 7 d | GIN on `topics` + partial published index |
| cross-party | 150 | 48 h | `StoredPost_civility_createdAt_idx` |
| trending | 100 | 6 h | `mv_trending_posts` precomputed |

**Decisions made inline:**
- Strict topic-match (Jaccard-style array overlap), not broader cluster-match — broader is C-phase.
- Following tab override: in-network only, full 1500 budget.
- Empty `topicInterests` falls back to trending-only (no out-of-network-topic results).
- Empty `affiliations` skips cross-party source (no defined "opposite").

### §2 — Visibility filter ([visibility.ts](../../../src/lib/algorithm/visibility.ts))

Single-pass filter, viewer-aware. Replaces the inline 3-line safety filter that was in the old pipeline.

- **Mutes:** `UserMute` table; respects `expiresAt`. Hides muted author's posts only.
- **Blocks:** `UserBlock` table; bidirectional (blocked viewer can't see blocker either).
- **Self-exclude:** Don't show viewer their own posts in For You (overridable for profile views).
- **Deletes:** `getDeletedPostIds()` tombstone set, unchanged.
- **Safety:** `botLikelihood > 0.9 || flagCount > 20 || toxicityScore > 0.95`, unchanged.

### §3 — Light ranker ([light-ranker.ts](../../../src/lib/algorithm/light-ranker.ts))

Cheap arithmetic, no Prisma. Narrows 1,500 → 200 (default).

```
lightScore = 0.35·recencyDecay      ← exp(-ageHours · ln2 / halfLife)
           + 0.30·post.civilityScore
           + 0.20·author.civicReputation
           + 0.15·Jaccard(post.topics, viewer.topicInterests)
```

Civility (post + author) is 50% of the light score — same civility supremacy as the heavy ranker. No engagement-prediction signals.

### §4 — Heavy ranker — Real-Graph signal added

`scoreCandidate` now takes an optional `ScoringContext` with an `affinityMap: Map<authorId, number>`. The new signal `realGraph` reads from this map (0 if missing).

**Weight redistribution (DEFAULT_CONFIG, sums to 1.00):**

| Signal | Before | After | Δ | Why |
|---|---:|---:|---:|---|
| engagementQuality | 0.20 | 0.15 | −0.05 | Trimmed because most engagement-prediction-adjacent |
| **civility** | **0.25** | **0.25** | 0 | Untouchable — mission anchor |
| viewpointDiversity | 0.15 | 0.15 | 0 | |
| sourceCredibility | 0.15 | 0.15 | 0 | |
| topicRelevance | 0.15 | 0.15 | 0 | |
| authorReputation | 0.10 | 0.05 | −0.05 | Halved — realGraph IS viewer-specific reputation |
| **realGraph** (NEW) | — | **0.10** | +0.10 | Viewer↔author affinity |

Cold-start `PHASE_CONFIGS` updated similarly:
- Phase 0: `realGraph = 0.00` (new users have no interaction history)
- Phase 1: `realGraph = 0.02`, `viewpointDiversity` 0.20→0.18 to make room
- Phase 2: `realGraph = 0.05`, `topicRelevance` 0.20→0.17, `engagementQuality` 0.20→0.18

Civility supremacy verified in test: `civility > realGraph * 2` for every phase.

### §5 — Real-Graph materialized view

Defined in [migration 20260522000000_x_algorithm_port](../../../prisma/migrations/20260522000000_x_algorithm_port/migration.sql).

```
affinity(viewer, author) = 1 - exp(-(
    0.4 · I[follows]
  + 0.6 · Σ exp(-(age_days/30))   over comments viewer left on author's posts in last 90d
))
```

Range [0, 1]. Recency decay (30-day half-life) on the comment-edge contribution.

**Data sources used:** `Follow`, `StoredComment` JOIN `StoredPost`.
**Data source deferred:** `Reaction` — currently in-memory and lost on cold start (ARCHITECTURE.md:777). Once reactions persist, extend the matview's `comment_edges` CTE with a `reaction_edges` CTE.

Refreshed CONCURRENTLY by Vercel Cron every 30 minutes (see §7).

### §6 — Cursor pagination

Cursor is opaque base64url-encoded JSON: `{ lastId, lastSort, mode }`.
Returned in response as `nextCursor`, accepted as `?after=<cursor>`.
For `mode=top`, the engine finds `lastId` in the ranked list and slices after it. For `mode=latest` (legacy path), it'd be `(createdAt, id)` — implemented when legacy engine is sunset.

### §7 — Vercel Cron + matview refresh

[/api/cron/refresh-feed-matviews](../../../src/app/api/cron/refresh-feed-matviews/route.ts) refreshes all three matviews CONCURRENTLY (no read-lockout). Scheduled `*/30 * * * *` via [vercel.json](../../../vercel.json).

**Auth:** `Authorization: Bearer $CRON_SECRET`. The `CRON_SECRET` env var must be set in Vercel before deploy.

### §8 — Rollout

**Feature flag:** `FEATURE_X_ENGINE=1` env, or `?engine=x` query param. Falls back gracefully:
- DB unavailable → falls back to legacy engine
- New pipeline throws → caught, logged, falls back to legacy engine
- `sort=latest` → always uses legacy path (cursor on latest is a later task)
- Cold-start → always uses legacy `generateColdStartFeed` (own candidate logic)

**Rollback:** unset `FEATURE_X_ENGINE`. Zero schema rollback needed since the new tables/indexes/matviews are additive.

## New surfaces

### Files added
- `src/lib/algorithm/candidates.ts` — 4-source candidate generator
- `src/lib/algorithm/visibility.ts` — viewer-aware filter
- `src/lib/algorithm/light-ranker.ts` — narrowing pass
- `src/lib/algorithm/real-graph.ts` — affinity-map fetch
- `src/app/api/cron/refresh-feed-matviews/route.ts` — cron handler
- `prisma/migrations/20260522000000_x_algorithm_port/migration.sql` — schema + matviews
- `vercel.json` — cron schedule
- `src/__tests__/x-algorithm-port.test.ts` — 12 unit tests

### Files modified
- `src/lib/algorithm/types.ts` — `realGraph` field in `SignalScores` and `AlgorithmWeights`; new pipeline interfaces
- `src/lib/algorithm/scoring.ts` — accepts `ScoringContext`, applies realGraph weight, adds explanation tag
- `src/lib/algorithm/signals.ts` — `computeRealGraph()` added
- `src/lib/algorithm/index.ts` — `generateForYouFeed()` async orchestrator; legacy `generateFeed` retained
- `src/lib/algorithm/cold-start.ts` — phase weights extended with `realGraph`
- `src/app/api/feed/route.ts` — X-engine path behind flag, cursor encode/decode
- `prisma/schema.prisma` — `UserMute`, `UserBlock` models
- `src/__tests__/cold-start.test.ts` — updated assertion for redistributed weight

## Operational notes

1. **Run the migration:** `npx prisma migrate deploy` (or `prisma migrate dev` locally).
2. **Set CRON_SECRET in Vercel** before enabling cron.
3. **Initial matview population:** `SELECT refresh_feed_matviews();` once after migration. Concurrent refresh requires existing rows, so first-time bootstrap is non-concurrent — done implicitly on `CREATE MATERIALIZED VIEW`.
4. **Enable flag gradually:** Start with `?engine=x` for internal testing, then `FEATURE_X_ENGINE=1` for full rollout.
5. **Observability:** Each X-engine response includes `meta.timing`, `meta.sources`, `meta.dropped` — log these to monitor stage performance.

## Phase-2 work (deferred, documented for future)

- **pgvector embeddings** — TwHIN-style user/post embeddings for semantic recall
- **SimClusters-lite** — community detection on follow+reaction graph for richer out-of-network candidates
- **Reaction persistence** — once reactions move out of memory, extend Real-Graph matview to include reaction edges
- **`latest`-mode cursor** — currently cursor only applies to `top` mode in the X engine
- **Per-viewer light-rank-keep tuning** — currently fixed at 200
