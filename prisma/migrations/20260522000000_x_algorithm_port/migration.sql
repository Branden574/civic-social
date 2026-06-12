-- ═══════════════════════════════════════════════════════════════
-- X-Algorithm Port — Migration
-- ═══════════════════════════════════════════════════════════════
-- Adds:
--   1. UserMute, UserBlock tables (enforce mutes in feed — gap noted
--      in ARCHITECTURE.md:754)
--   2. Indexes on StoredPost for candidate-generation queries
--      (in-network, out-of-network topic, cross-party civil)
--   3. Materialized views for hot feature stores:
--        * mv_real_graph_affinity   (viewer ↔ author interaction)
--        * mv_trending_posts        (engagement velocity × civility)
--        * mv_author_profile        (denormalized author features)
--   4. Refresh helper function used by Vercel Cron
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Mute / Block tables ───────────────────────────────────

CREATE TABLE "UserMute" (
  "id" TEXT NOT NULL,
  "muterId" TEXT NOT NULL,
  "mutedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "reason" TEXT,
  CONSTRAINT "UserMute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMute_muterId_mutedId_key"
  ON "UserMute" ("muterId", "mutedId");
CREATE INDEX "UserMute_muterId_idx" ON "UserMute" ("muterId");
CREATE INDEX "UserMute_expiresAt_idx" ON "UserMute" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL;

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key"
  ON "UserBlock" ("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock" ("blockerId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock" ("blockedId");

-- ─── 2. Candidate-query indexes on StoredPost ─────────────────

-- Partial index for the "published, not deleted" predicate every
-- candidate query carries. Postgres prefers a partial here because
-- ~95% of rows match the predicate but the planner still benefits.
CREATE INDEX "StoredPost_published_createdAt_idx"
  ON "StoredPost" ("createdAt" DESC)
  WHERE "status" = 'published' AND "deletedAt" IS NULL;

-- For in-network: (authorId, createdAt DESC) under same predicate
CREATE INDEX "StoredPost_author_published_createdAt_idx"
  ON "StoredPost" ("authorId", "createdAt" DESC)
  WHERE "status" = 'published' AND "deletedAt" IS NULL;

-- GIN for topic overlap (out-of-network topic + hashtag)
CREATE INDEX "StoredPost_topics_gin_idx"
  ON "StoredPost" USING GIN ("topics");

-- For cross-party civil source: civility-then-recency under predicate
CREATE INDEX "StoredPost_civility_createdAt_idx"
  ON "StoredPost" ("civilityScore" DESC, "createdAt" DESC)
  WHERE "status" = 'published' AND "deletedAt" IS NULL;

-- ─── 3. Materialized views ────────────────────────────────────

-- 3a. AuthorProfile: denormalized author features for candidate JOINs
--     Refreshed hourly. Reading authors from this matview avoids
--     fanning out to UserAffiliation/PoliticalParty on every feed request.
CREATE MATERIALIZED VIEW "mv_author_profile" AS
SELECT
  u."id"                                              AS "authorId",
  u."displayName",
  u."username",
  u."avatar",
  u."civicReputation",
  u."civilityAvg",
  u."accuracyScore",
  u."verificationLevel"::text                         AS "verificationLevel",
  COALESCE(
    array_agg(DISTINCT pp."name") FILTER (WHERE pp."name" IS NOT NULL),
    ARRAY[]::text[]
  )                                                   AS "affiliations"
FROM "User" u
LEFT JOIN "UserAffiliation" ua ON ua."userId"  = u."id"
LEFT JOIN "PoliticalParty"  pp ON pp."id"      = ua."partyId"
GROUP BY u."id";

CREATE UNIQUE INDEX "mv_author_profile_authorId_idx"
  ON "mv_author_profile" ("authorId");

-- 3b. RealGraph: viewer ↔ author interaction affinity.
--     Combines (a) follow edges, (b) comment authorship overlap,
--     (c) post-author engagement count via StoredComment.
--     Affinity ∈ [0, 1], computed with recency decay (last 90d).
--
--     Formula:
--       affinity = 1 - exp(-( follows*0.4 + comments_decayed*0.6 ))
--       where comments_decayed sums exp(-age_days/30) for each
--       comment the viewer left on a post by the author.
CREATE MATERIALIZED VIEW "mv_real_graph_affinity" AS
WITH follow_edges AS (
  SELECT
    "followerId" AS "viewerId",
    "followingId" AS "authorId",
    1.0::float AS "follow_score"
  FROM "Follow"
),
comment_edges AS (
  SELECT
    sc."authorId" AS "viewerId",
    sp."authorId" AS "authorId",
    SUM(EXP(-GREATEST(0, EXTRACT(EPOCH FROM (now() - sc."createdAt"))/86400.0)/30.0))::float
      AS "comment_score"
  FROM "StoredComment" sc
  JOIN "StoredPost" sp ON sp."id" = sc."postId"
  WHERE sc."createdAt" > now() - interval '90 days'
    AND sc."authorId" <> sp."authorId"
    AND sc."status" = 'published'
    AND sc."deletedAt" IS NULL
  GROUP BY sc."authorId", sp."authorId"
)
SELECT
  COALESCE(f."viewerId", c."viewerId") AS "viewerId",
  COALESCE(f."authorId", c."authorId") AS "authorId",
  (1.0 - EXP(-(
    COALESCE(f."follow_score", 0) * 0.4
    + COALESCE(c."comment_score", 0) * 0.6
  )))::float AS "affinity"
FROM follow_edges f
FULL OUTER JOIN comment_edges c
  ON f."viewerId" = c."viewerId" AND f."authorId" = c."authorId"
WHERE COALESCE(f."viewerId", c."viewerId") IS NOT NULL
  AND COALESCE(f."authorId", c."authorId") IS NOT NULL;

CREATE UNIQUE INDEX "mv_real_graph_affinity_pk"
  ON "mv_real_graph_affinity" ("viewerId", "authorId");
CREATE INDEX "mv_real_graph_affinity_viewer_idx"
  ON "mv_real_graph_affinity" ("viewerId", "affinity" DESC);

-- 3c. Trending: posts with high engagement velocity AND high civility.
--     Refreshed every 5 minutes by cron.
--     Velocity = comments_in_last_6h / hours_alive.
CREATE MATERIALIZED VIEW "mv_trending_posts" AS
SELECT
  sp."id"             AS "postId",
  sp."authorId",
  sp."content",
  sp."topics",
  sp."civilityScore",
  sp."createdAt",
  COUNT(sc."id")::int AS "recent_comment_count",
  (COUNT(sc."id")::float
    / GREATEST(EXTRACT(EPOCH FROM (now() - sp."createdAt"))/3600.0, 1.0)
  ) AS "velocity",
  ((COUNT(sc."id")::float
    / GREATEST(EXTRACT(EPOCH FROM (now() - sp."createdAt"))/3600.0, 1.0)
   ) * sp."civilityScore"
  ) AS "trending_score"
FROM "StoredPost" sp
LEFT JOIN "StoredComment" sc
  ON sc."postId" = sp."id"
  AND sc."createdAt" > now() - interval '6 hours'
  AND sc."status" = 'published'
  AND sc."deletedAt" IS NULL
WHERE sp."createdAt" > now() - interval '24 hours'
  AND sp."status" = 'published'
  AND sp."deletedAt" IS NULL
  AND sp."civilityScore" >= 0.7
GROUP BY sp."id"
HAVING COUNT(sc."id") >= 2;

CREATE UNIQUE INDEX "mv_trending_posts_postId_idx"
  ON "mv_trending_posts" ("postId");
CREATE INDEX "mv_trending_posts_score_idx"
  ON "mv_trending_posts" ("trending_score" DESC);

-- ─── 4. Refresh helper ────────────────────────────────────────
-- Called by Vercel Cron via /api/cron/refresh-feed-matviews.
-- CONCURRENTLY avoids feed query lockouts during refresh.

CREATE OR REPLACE FUNCTION refresh_feed_matviews() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_author_profile";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_real_graph_affinity";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_trending_posts";
END;
$$ LANGUAGE plpgsql;
