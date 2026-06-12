// ═══════════════════════════════════════════════════════════════
// Civic Social — Refresh feed materialized views (Vercel Cron)
// ═══════════════════════════════════════════════════════════════
//
// Triggered by Vercel Cron on the schedule defined in vercel.json:
//   /api/cron/refresh-feed-matviews  →  every 30 minutes
//
// Refreshes (CONCURRENTLY — no read-lockout):
//   * mv_author_profile        (denormalized author features)
//   * mv_real_graph_affinity   (viewer ↔ author affinity)
//   * mv_trending_posts        (engagement velocity × civility)
//
// Auth: Vercel Cron sets the `authorization` header to
// `Bearer ${CRON_SECRET}`. Reject everything else.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDbAvailable } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Auth: only Vercel Cron may invoke ────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isDbAvailable() || !prisma) {
    return NextResponse.json(
      { error: 'database unavailable' },
      { status: 503 },
    );
  }

  const t0 = Date.now();
  const results: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  for (const view of [
    'mv_author_profile',
    'mv_real_graph_affinity',
    'mv_trending_posts',
  ]) {
    const ts = Date.now();
    try {
      await prisma.$executeRawUnsafe(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`,
      );
      results[view] = { ok: true, ms: Date.now() - ts };
    } catch (err) {
      results[view] = {
        ok: false,
        ms: Date.now() - ts,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const failed = Object.values(results).some((r) => !r.ok);
  return NextResponse.json(
    {
      ok: !failed,
      totalMs: Date.now() - t0,
      views: results,
    },
    { status: failed ? 500 : 200 },
  );
}
