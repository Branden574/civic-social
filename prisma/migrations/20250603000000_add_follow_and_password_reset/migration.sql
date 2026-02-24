-- SearchableUserFollow: persists follow relationships for real users
CREATE TABLE "SearchableUserFollow" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "followerId"  TEXT        NOT NULL,
  "followingId" TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchableUserFollow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SearchableUserFollow_followerId_followingId_key" UNIQUE ("followerId", "followingId")
);
CREATE INDEX "SearchableUserFollow_followerId_idx" ON "SearchableUserFollow"("followerId");
CREATE INDEX "SearchableUserFollow_followingId_idx" ON "SearchableUserFollow"("followingId");

-- PasswordResetToken: one-time tokens for forgot-password flow
CREATE TABLE "PasswordResetToken" (
  "id"        TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "token"     TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
