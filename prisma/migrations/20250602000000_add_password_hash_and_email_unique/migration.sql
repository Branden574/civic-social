-- Add passwordHash column for server-side auth (nullable — existing rows won't have one)
ALTER TABLE "SearchableUser" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
