// ═══════════════════════════════════════════════════════════════
// Prisma client singleton for Next.js serverless
// Uses @prisma/adapter-pg with a direct TCP postgres URL so the
// app works with `prisma dev` v0.15 + Prisma Client 7.4.0.
// Falls back to Prisma Accelerate (accelerateUrl) when DIRECT_URL
// is not set — used for cloud/Vercel deployments.
// When neither URL is configured, isDbAvailable() returns false
// and the app falls back to in-memory stores.
// ═══════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function isDbAvailable(): boolean {
  return Boolean(process.env.DIRECT_URL ?? process.env.DATABASE_URL);
}

function createPrismaClient(): PrismaClient {
  const directUrl = process.env.DIRECT_URL;
  if (directUrl) {
    // Local dev: direct TCP connection via pg adapter
    const pool = new Pool({ connectionString: directUrl });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  // Cloud/Vercel: use Prisma Accelerate URL
  return new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL!,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Only instantiate when a DB URL is configured — avoids crashing on cold
// starts when no database is connected (in-memory fallback is used instead).
export const prisma = globalForPrisma.prisma ?? (
  isDbAvailable() ? createPrismaClient() : (null as unknown as PrismaClient)
);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
