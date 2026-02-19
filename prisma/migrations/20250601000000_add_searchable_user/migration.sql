-- CreateTable
CREATE TABLE "SearchableUser" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "affiliation" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "verificationLevel" TEXT NOT NULL DEFAULT 'EMAIL_VERIFIED',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "credibilityScore" INTEGER NOT NULL DEFAULT 50,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayNameNorm" TEXT NOT NULL,
    "usernameNorm" TEXT NOT NULL,

    CONSTRAINT "SearchableUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchableUser_usernameNorm_idx" ON "SearchableUser"("usernameNorm");

-- CreateIndex
CREATE INDEX "SearchableUser_displayNameNorm_idx" ON "SearchableUser"("displayNameNorm");
