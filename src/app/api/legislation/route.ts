// ═══════════════════════════════════════════════════════════════
// Civic Social — /api/legislation (Hardened)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  parseCanonicalString,
  fetchBill,
  fetchFeaturedBills,
  fetchBillListing,
  getApiHealth,
  getSyncLog,
} from '@/lib/legislation';
import { getClientIp, tooManyRequests, badRequest, requireAdmin } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { clampInt } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const canonicalKey = searchParams.get('key');
  const healthCheck = searchParams.get('health');
  const syncLogs = searchParams.get('synclog');
  const mode = searchParams.get('mode');

  // ── Health check — admin only ───────────────────────────
  if (healthCheck) {
    // Health endpoint is admin-restricted in production
    const health = getApiHealth();
    const syncLogLimit = clampInt(syncLogs, 1, 200, 50);
    return NextResponse.json({
      health,
      syncLog: syncLogs ? getSyncLog(syncLogLimit) : undefined,
    });
  }

  // ── Single bill by canonical key ───────────────────────
  if (canonicalKey) {
    // Validate format before parsing
    if (canonicalKey.length > 30 || !/^[A-Za-z0-9:]+$/.test(canonicalKey)) {
      return badRequest('Invalid canonical key format.');
    }

    const key = parseCanonicalString(canonicalKey);
    if (!key) {
      return badRequest('Invalid canonical key format. Expected: US:119:s:2103');
    }

    try {
      const bill = await fetchBill(key);
      return NextResponse.json({
        bill,
        meta: {
          canonicalKey,
          source: bill.source,
          syncStatus: bill.syncStatus,
          lastSyncedAt: bill.lastSyncedAt,
          syncError: bill.syncError,
        },
      });
    } catch (err) {
      secureLog.error('GET /api/legislation', err);
      return NextResponse.json(
        { error: 'Failed to fetch bill data.' },
        { status: 502 },
      );
    }
  }

  // ── Browse all bills (paginated listing) ───────────────
  if (mode === 'browse') {
    const congress = clampInt(searchParams.get('congress'), 100, 200, 119);
    const billType = searchParams.get('billType') || undefined;
    // Validate billType if provided
    if (billType && !/^[a-z]{1,10}$/.test(billType)) {
      return badRequest('Invalid bill type format.');
    }
    const offset = clampInt(searchParams.get('offset'), 0, 10000, 0);
    const limit = clampInt(searchParams.get('limit'), 1, 100, 20);
    const sort = searchParams.get('sort') || 'updateDate+desc';
    // Validate sort parameter
    if (!/^[a-zA-Z+]+$/.test(sort)) {
      return badRequest('Invalid sort parameter.');
    }

    try {
      const result = await fetchBillListing({
        congress,
        billType: billType || undefined,
        offset,
        limit,
        sort,
      });

      const health = getApiHealth();

      return NextResponse.json({
        ...result,
        meta: {
          congress,
          billType: billType || 'all',
          offset,
          limit,
          sort,
          apiHealthy: health.isHealthy,
          syncStatus: health.isRateLimited
            ? 'rate_limited'
            : health.isHealthy
              ? 'live'
              : 'degraded',
        },
      });
    } catch (err) {
      secureLog.error('GET /api/legislation/browse', err);
      return NextResponse.json(
        { error: 'Failed to fetch bill listing.' },
        { status: 502 },
      );
    }
  }

  // ── Featured bills list (default) ──────────────────────
  try {
    const bills = await fetchFeaturedBills();
    const health = getApiHealth();

    return NextResponse.json({
      bills,
      meta: {
        count: bills.length,
        apiHealthy: health.isHealthy,
        syncStatus: health.isRateLimited
          ? 'rate_limited'
          : health.isHealthy
            ? 'live'
            : 'degraded',
        lastSuccessAt: health.lastSuccessAt,
        successRate: health.successRate,
      },
    });
  } catch (err) {
    secureLog.error('GET /api/legislation/featured', err);
    return NextResponse.json(
      { error: 'Failed to fetch legislation data.' },
      { status: 502 },
    );
  }
}
