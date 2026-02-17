// ═══════════════════════════════════════════════════════════════
// Civic Social — Congress.gov API Client
// ═══════════════════════════════════════════════════════════════
//
// Fetches real bill data from the official Congress.gov API v3.
// When the API key is not configured or the API fails, the system
// falls back to cached data with a clear "stale" indicator, or
// marks data as "demo" with a prominent disclaimer.
//
// API docs: https://api.congress.gov/
//
// INVARIANT: We NEVER show wrong data. If we can't verify data
//            matches the canonical key, we show "unavailable".
// ═══════════════════════════════════════════════════════════════

import {
  type CanonicalBillKey,
  toCanonicalString,
  toCongressApiPath,
  toCongressGovUrl,
  toCongressGovTextUrl,
  toDisplayCode,
  getBillTypeInfo,
  validateBillMatch,
} from './canonical-key';
import type {
  OfficialBillData,
  OfficialSponsor,
  OfficialCosponsor,
  LegislativeAction,
  OfficialBillStatus,
  DataSource,
  SyncStatus,
  SyncLogEntry,
  ApiHealth,
} from './types';
import { generateImpactAnalysis } from './impact-generator';
import { generateAiSummary } from './ai-summary-generator';

// ─── Configuration ───────────────────────────────────────────

const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const API_KEY = process.env.CONGRESS_API_KEY || '';

// ─── In-memory cache ─────────────────────────────────────────
// Production: replace with Redis / database
// Cache keys ALWAYS include congress session (canonical key)

interface CacheEntry {
  data: OfficialBillData;
  fetchedAt: number;
  ttlMs: number;
}

const billCache = new Map<string, CacheEntry>();
const syncLog: SyncLogEntry[] = [];

// TTL: 2 min for high-priority, 15 min for normal
const HIGH_PRIORITY_TTL = 2 * 60 * 1000;
const NORMAL_TTL = 15 * 60 * 1000;

// ─── API health tracking ─────────────────────────────────────

const healthState = {
  totalRequests: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  lastSuccessAt: null as string | null,
  lastFailureAt: null as string | null,
  latencies: [] as number[],
  isRateLimited: false,
};

function recordSuccess(durationMs: number) {
  healthState.totalRequests++;
  healthState.totalSuccesses++;
  healthState.lastSuccessAt = new Date().toISOString();
  healthState.latencies.push(durationMs);
  if (healthState.latencies.length > 100) healthState.latencies.shift();
  healthState.isRateLimited = false;
}

function recordFailure(durationMs: number, isRateLimit: boolean) {
  healthState.totalRequests++;
  healthState.totalFailures++;
  healthState.lastFailureAt = new Date().toISOString();
  healthState.latencies.push(durationMs);
  if (healthState.latencies.length > 100) healthState.latencies.shift();
  if (isRateLimit) healthState.isRateLimited = true;
}

// ─── Sync log recording ─────────────────────────────────────

function logSync(entry: SyncLogEntry) {
  syncLog.push(entry);
  if (syncLog.length > 500) syncLog.shift();
}

// ─── Map Congress API status to our status ────────────────────

function mapToOfficialStatus(apiData: Record<string, unknown>): OfficialBillStatus {
  // The Congress API doesn't have a single "status" field.
  // We derive it from the latest action and other fields.
  const latestAction = (apiData.latestAction as Record<string, unknown>)?.text as string || '';
  const lower = latestAction.toLowerCase();

  if (lower.includes('became public law') || lower.includes('signed by president')) return 'became_law';
  if (lower.includes('vetoed')) return 'vetoed';
  if (lower.includes('passed house') && lower.includes('passed senate')) return 'resolving_differences';
  if (lower.includes('passed house')) return 'passed_house';
  if (lower.includes('passed senate')) return 'passed_senate';
  if (lower.includes('reported by') || lower.includes('ordered to be reported')) return 'reported_by_committee';
  if (lower.includes('referred to')) return 'referred_to_committee';
  if (lower.includes('presented to president')) return 'to_president';

  return 'introduced';
}

// ─── Map API response → OfficialBillData ─────────────────────

function mapApiBill(
  key: CanonicalBillKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiResponse: any,
): OfficialBillData {
  const bill = apiResponse.bill || apiResponse;
  const now = new Date().toISOString();

  // Extract sponsor
  let sponsor: OfficialSponsor | null = null;
  if (bill.sponsors && bill.sponsors.length > 0) {
    const s = bill.sponsors[0];
    sponsor = {
      bioguideId: s.bioguideId || '',
      fullName: s.fullName || s.firstName + ' ' + s.lastName,
      party: s.party || '',
      state: s.state || '',
      district: s.district,
      isByRequest: s.isByRequest || false,
    };
  }

  // Extract latest action
  let latestAction: LegislativeAction | null = null;
  if (bill.latestAction) {
    latestAction = {
      date: bill.latestAction.actionDate || bill.latestAction.date || '',
      text: bill.latestAction.text || '',
      type: bill.latestAction.type || '',
      actionCode: bill.latestAction.actionCode,
      sourceSystem: bill.latestAction.sourceSystem?.name || '',
    };
  }

  // Extract subjects
  const subjects: string[] = [];
  if (bill.policyArea?.name) subjects.push(bill.policyArea.name);
  if (bill.subjects?.legislativeSubjects) {
    for (const sub of bill.subjects.legislativeSubjects) {
      if (sub.name) subjects.push(sub.name);
    }
  }

  return {
    canonicalKey: toCanonicalString(key),
    key,
    billCode: toDisplayCode(key),
    officialTitle: bill.title || 'Title not available',
    shortTitle: bill.shortTitle || undefined,
    congress: bill.congress || key.congress,
    billType: bill.type || key.billType,
    billNumber: bill.number || key.billNumber,
    originChamber: getBillTypeInfo(key.billType).chamber === 'senate' ? 'Senate' : 'House',
    sponsor,
    cosponsorCount: bill.cosponsors?.count || 0,
    cosponsors: [],
    latestAction,
    actions: [],
    introducedDate: bill.introducedDate || '',
    status: mapToOfficialStatus(bill),
    policyArea: bill.policyArea?.name,
    officialSummary: undefined,
    officialSummaryHtml: undefined,
    summarySource: 'none',
    congressGovUrl: toCongressGovUrl(key),
    officialTextUrl: toCongressGovTextUrl(key),
    source: 'congress_api',
    syncStatus: 'live',
    lastSyncedAt: now,
    lastSyncAttemptAt: now,
    subjects,
    discussionCount: 0,
    followersCount: 0,
  };
}

// ─── Strip HTML tags for plain text ──────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Fetch sub-endpoints (actions, cosponsors, summaries) ────

async function fetchSubEndpoints(
  key: CanonicalBillKey,
): Promise<{
  actions: LegislativeAction[];
  cosponsors: OfficialCosponsor[];
  summary?: string;
  summaryHtml?: string;
  summaryDate?: string;
}> {
  const apiPath = toCongressApiPath(key);
  const results = { actions: [] as LegislativeAction[], cosponsors: [] as OfficialCosponsor[], summary: undefined as string | undefined, summaryHtml: undefined as string | undefined, summaryDate: undefined as string | undefined };

  if (!API_KEY) return results;

  // Fetch all 3 in parallel
  const [actionsRes, cosponsorsRes, summariesRes] = await Promise.allSettled([
    fetch(`${CONGRESS_API_BASE}${apiPath}/actions?api_key=${API_KEY}&format=json&limit=50`, {
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`${CONGRESS_API_BASE}${apiPath}/cosponsors?api_key=${API_KEY}&format=json&limit=50`, {
      signal: AbortSignal.timeout(8000),
    }),
    fetch(`${CONGRESS_API_BASE}${apiPath}/summaries?api_key=${API_KEY}&format=json`, {
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  // Parse actions
  if (actionsRes.status === 'fulfilled' && actionsRes.value.ok) {
    try {
      const json = await actionsRes.value.json();
      const actions = json.actions || [];
      results.actions = actions.map((a: Record<string, unknown>) => ({
        date: (a.actionDate as string) || '',
        text: (a.text as string) || '',
        type: (a.type as string) || '',
        actionCode: (a.actionCode as string) || undefined,
        sourceSystem: ((a.sourceSystem as Record<string, unknown>)?.name as string) || '',
      }));
    } catch { /* ignore parse errors */ }
  }

  // Parse cosponsors
  if (cosponsorsRes.status === 'fulfilled' && cosponsorsRes.value.ok) {
    try {
      const json = await cosponsorsRes.value.json();
      const cosponsors = json.cosponsors || [];
      results.cosponsors = cosponsors.map((c: Record<string, unknown>) => ({
        bioguideId: (c.bioguideId as string) || '',
        fullName: (c.fullName as string) || '',
        party: (c.party as string) || '',
        state: (c.state as string) || '',
        district: c.district as number | undefined,
        sponsorshipDate: (c.sponsorshipDate as string) || undefined,
      }));
    } catch { /* ignore parse errors */ }
  }

  // Parse summaries (take the most recent)
  if (summariesRes.status === 'fulfilled' && summariesRes.value.ok) {
    try {
      const json = await summariesRes.value.json();
      const summaries = json.summaries || [];
      if (summaries.length > 0) {
        // Sort by updateDate descending and take most recent
        const sorted = [...summaries].sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((b.updateDate as string) || '').localeCompare((a.updateDate as string) || ''),
        );
        const best = sorted[0];
        const htmlText = (best.text as string) || '';
        results.summaryHtml = htmlText;
        results.summary = stripHtml(htmlText);
        results.summaryDate = (best.updateDate as string) || undefined;
      }
    } catch { /* ignore parse errors */ }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Public API: fetchBill
// ═══════════════════════════════════════════════════════════════

export async function fetchBill(
  key: CanonicalBillKey,
  options: { highPriority?: boolean; forceRefresh?: boolean } = {},
): Promise<OfficialBillData> {
  const canonicalStr = toCanonicalString(key);
  const ttl = options.highPriority ? HIGH_PRIORITY_TTL : NORMAL_TTL;
  const startTime = Date.now();

  // ── Check cache (unless forced refresh) ────────────────
  if (!options.forceRefresh) {
    const cached = billCache.get(canonicalStr);
    if (cached && (Date.now() - cached.fetchedAt < cached.ttlMs)) {
      return { ...cached.data, source: 'cached' as DataSource, syncStatus: 'live' as SyncStatus };
    }
  }

  // ── Attempt live fetch ─────────────────────────────────
  if (!API_KEY) {
    // No API key configured — return "demo" marked data
    const durationMs = Date.now() - startTime;
    logSync({
      canonicalKey: canonicalStr,
      timestamp: new Date().toISOString(),
      success: false,
      source: 'demo',
      durationMs,
      error: 'CONGRESS_API_KEY not configured',
    });
    return buildDemoFallback(key, 'CONGRESS_API_KEY environment variable not set. Showing demonstration data only.');
  }

  try {
    const apiPath = toCongressApiPath(key);
    const url = `${CONGRESS_API_BASE}${apiPath}?api_key=${API_KEY}&format=json`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const durationMs = Date.now() - startTime;

    if (res.status === 429) {
      recordFailure(durationMs, true);
      logSync({
        canonicalKey: canonicalStr,
        timestamp: new Date().toISOString(),
        success: false,
        source: 'congress_api',
        durationMs,
        httpStatus: 429,
        error: 'Rate limited by Congress API',
      });
      // Return stale cache if available
      const stale = billCache.get(canonicalStr);
      if (stale) {
        return { ...stale.data, syncStatus: 'stale', syncError: 'Rate limited — showing cached data' };
      }
      return buildDemoFallback(key, 'Congress API rate limited. Retrying shortly.');
    }

    if (!res.ok) {
      recordFailure(durationMs, false);
      logSync({
        canonicalKey: canonicalStr,
        timestamp: new Date().toISOString(),
        success: false,
        source: 'congress_api',
        durationMs,
        httpStatus: res.status,
        error: `HTTP ${res.status}: ${res.statusText}`,
      });
      // Fallback to cache
      const stale = billCache.get(canonicalStr);
      if (stale) {
        return { ...stale.data, syncStatus: 'stale', syncError: `API returned ${res.status}` };
      }
      return buildDemoFallback(key, `Congress API returned ${res.status}. Data temporarily unavailable.`);
    }

    const json = await res.json();

    // ── MISMATCH DETECTION (critical) ────────────────────
    const fetchedBill = json.bill || json;
    const validation = validateBillMatch(key, {
      congress: fetchedBill.congress,
      type: fetchedBill.type,
      number: fetchedBill.number,
    });

    if (!validation.valid) {
      const mismatchMsg = `MISMATCH DETECTED: ${validation.mismatches.join('; ')}`;
      recordFailure(durationMs, false);
      logSync({
        canonicalKey: canonicalStr,
        timestamp: new Date().toISOString(),
        success: false,
        source: 'congress_api',
        durationMs,
        error: mismatchMsg,
        mismatchDetected: true,
        mismatchDetails: mismatchMsg,
      });
      // DO NOT render mismatched data — use cache or mark unavailable
      const stale = billCache.get(canonicalStr);
      if (stale) {
        return { ...stale.data, syncStatus: 'error', syncError: 'Data mismatch detected. Showing last verified data.' };
      }
      return buildUnavailable(key, mismatchMsg);
    }

    // ── Success: map, cache, and return ──────────────────
    const billData = mapApiBill(key, json);
    recordSuccess(durationMs);

    // ── Fetch sub-endpoints (actions, cosponsors, summaries) ──
    try {
      const sub = await fetchSubEndpoints(key);
      billData.actions = sub.actions;
      billData.cosponsors = sub.cosponsors;
      if (sub.summary) {
        billData.officialSummary = sub.summary;
        billData.officialSummaryHtml = sub.summaryHtml;
        billData.summarySource = 'crs';
        billData.summaryDate = sub.summaryDate;
      }
    } catch {
      // Sub-endpoints are best-effort; don't fail the whole request
    }

    // ── Generate impact analysis from the real summary ───
    try {
      billData.impactAnalysis = generateImpactAnalysis(billData);
    } catch {
      // Impact analysis is best-effort
    }

    // ── Generate AI plain-language summary ────────────────
    try {
      billData.aiSummary = generateAiSummary(billData);
    } catch {
      // AI summary is best-effort
    }

    billCache.set(canonicalStr, {
      data: billData,
      fetchedAt: Date.now(),
      ttlMs: ttl,
    });

    logSync({
      canonicalKey: canonicalStr,
      timestamp: new Date().toISOString(),
      success: true,
      source: 'congress_api',
      durationMs,
    });

    return billData;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    recordFailure(durationMs, false);
    logSync({
      canonicalKey: canonicalStr,
      timestamp: new Date().toISOString(),
      success: false,
      source: 'congress_api',
      durationMs,
      error: errorMsg,
    });

    // Fallback to cache
    const stale = billCache.get(canonicalStr);
    if (stale) {
      return { ...stale.data, syncStatus: 'stale', syncError: errorMsg };
    }
    return buildDemoFallback(key, `Could not reach Congress API: ${errorMsg}`);
  }
}

// ─── Demo fallback builder ───────────────────────────────────
// CLEARLY marked as demo — never confused with real data.

function buildDemoFallback(key: CanonicalBillKey, reason: string): OfficialBillData {
  const now = new Date().toISOString();
  return {
    canonicalKey: toCanonicalString(key),
    key,
    billCode: toDisplayCode(key),
    officialTitle: `[Demo Data] ${toDisplayCode(key)} — Official title unavailable`,
    shortTitle: undefined,
    congress: key.congress,
    billType: key.billType,
    billNumber: key.billNumber,
    originChamber: getBillTypeInfo(key.billType).chamber === 'senate' ? 'Senate' : 'House',
    sponsor: null,
    cosponsorCount: 0,
    cosponsors: [],
    latestAction: null,
    actions: [],
    introducedDate: '',
    status: 'introduced',
    policyArea: undefined,
    congressGovUrl: toCongressGovUrl(key),
    officialTextUrl: toCongressGovTextUrl(key),
    source: 'demo',
    syncStatus: 'demo',
    lastSyncedAt: now,
    lastSyncAttemptAt: now,
    syncError: reason,
    subjects: [],
    discussionCount: 0,
    followersCount: 0,
  };
}

function buildUnavailable(key: CanonicalBillKey, reason: string): OfficialBillData {
  const now = new Date().toISOString();
  return {
    canonicalKey: toCanonicalString(key),
    key,
    billCode: toDisplayCode(key),
    officialTitle: `Data unavailable for ${toDisplayCode(key)}`,
    congress: key.congress,
    billType: key.billType,
    billNumber: key.billNumber,
    originChamber: getBillTypeInfo(key.billType).chamber === 'senate' ? 'Senate' : 'House',
    sponsor: null,
    cosponsorCount: 0,
    cosponsors: [],
    latestAction: null,
    actions: [],
    introducedDate: '',
    status: 'introduced',
    congressGovUrl: toCongressGovUrl(key),
    officialTextUrl: toCongressGovTextUrl(key),
    source: 'unavailable',
    syncStatus: 'error',
    lastSyncedAt: now,
    lastSyncAttemptAt: now,
    syncError: reason,
    subjects: [],
    discussionCount: 0,
    followersCount: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// Public API: fetchBillListing
// ═══════════════════════════════════════════════════════════════
// Fetches a paginated list of bills from the Congress.gov API.
// Uses /bill/{congress} which returns lightweight bill summaries.
// This is much faster than fetching full details for each bill.

import type { BillListingItem, BillListingResponse } from './types';

// Cache for listing results (keyed by request params)
interface ListingCacheEntry {
  data: BillListingResponse;
  fetchedAt: number;
}
const listingCache = new Map<string, ListingCacheEntry>();
const LISTING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Bill type mapping: Congress API returns uppercase (e.g. "HR"), we need lowercase
const BILL_TYPE_LOWER: Record<string, string> = {
  HR: 'hr', S: 's', HJRES: 'hjres', SJRES: 'sjres',
  HCONRES: 'hconres', SCONRES: 'sconres', HRES: 'hres', SRES: 'sres',
};

const BILL_TYPE_DISPLAY: Record<string, string> = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
};

export async function fetchBillListing(options: {
  congress?: number;
  billType?: string;       // "hr", "s", etc. — optional type filter
  offset?: number;
  limit?: number;
  sort?: string;           // "updateDate+desc" (default), "updateDate+asc"
  fromDateTime?: string;   // ISO datetime filter for updateDateTimeFrom
  toDateTime?: string;     // ISO datetime filter for updateDateTimeTo
} = {}): Promise<BillListingResponse> {
  const {
    congress = 119,
    billType,
    offset = 0,
    limit = 20,
    sort = 'updateDate+desc',
    fromDateTime,
    toDateTime,
  } = options;

  // Build cache key from all parameters
  const cacheKey = `listing:${congress}:${billType || 'all'}:${offset}:${limit}:${sort}:${fromDateTime || ''}:${toDateTime || ''}`;

  // Check cache
  const cached = listingCache.get(cacheKey);
  if (cached && (Date.now() - cached.fetchedAt < LISTING_CACHE_TTL)) {
    return { ...cached.data, source: 'cached' };
  }

  // No API key — return empty with demo marker
  if (!API_KEY) {
    return {
      bills: [],
      pagination: { count: 0, next: null, prev: null },
      source: 'demo',
    };
  }

  const startTime = Date.now();

  try {
    // Build URL: /bill/{congress} or /bill/{congress}/{billType}
    let apiPath = `/bill/${congress}`;
    if (billType) {
      apiPath += `/${billType.toLowerCase()}`;
    }

    const params = new URLSearchParams({
      api_key: API_KEY,
      format: 'json',
      offset: String(offset),
      limit: String(Math.min(limit, 250)), // Congress API max is 250
      sort,
    });

    if (fromDateTime) params.set('fromDateTime', fromDateTime);
    if (toDateTime) params.set('toDateTime', toDateTime);

    const url = `${CONGRESS_API_BASE}${apiPath}?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000), // 15s — listing can be slower
    });

    const durationMs = Date.now() - startTime;

    if (res.status === 429) {
      recordFailure(durationMs, true);
      // Return stale cache if available
      const stale = listingCache.get(cacheKey);
      if (stale) return { ...stale.data, source: 'cached' };
      return { bills: [], pagination: { count: 0, next: null, prev: null }, source: 'unavailable' };
    }

    if (!res.ok) {
      recordFailure(durationMs, false);
      const stale = listingCache.get(cacheKey);
      if (stale) return { ...stale.data, source: 'cached' };
      return { bills: [], pagination: { count: 0, next: null, prev: null }, source: 'unavailable' };
    }

    const json = await res.json();
    recordSuccess(durationMs);

    // Map response to our types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bills: BillListingItem[] = (json.bills || []).map((b: any) => {
      const typeUpper = (b.type || '').toUpperCase();
      const typeLower = BILL_TYPE_LOWER[typeUpper] || typeUpper.toLowerCase();
      const displayPrefix = BILL_TYPE_DISPLAY[typeUpper] || typeUpper;
      const num = typeof b.number === 'string' ? parseInt(b.number, 10) : (b.number || 0);

      return {
        congress: b.congress || congress,
        number: num,
        type: typeUpper,
        typeLower,
        title: b.title || 'Untitled',
        originChamber: b.originChamber || '',
        originChamberCode: b.originChamberCode || '',
        updateDate: b.updateDate || '',
        latestActionDate: b.latestAction?.actionDate || '',
        latestActionText: b.latestAction?.text || '',
        url: b.url || '',
        canonicalKey: `US:${congress}:${typeLower}:${num}`,
        displayCode: `${displayPrefix} ${num}`,
      };
    });

    const result: BillListingResponse = {
      bills,
      pagination: {
        count: json.pagination?.count || 0,
        next: json.pagination?.next || null,
        prev: json.pagination?.prev || null,
      },
      source: 'congress_api',
    };

    // Cache the result
    listingCache.set(cacheKey, { data: result, fetchedAt: Date.now() });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    recordFailure(durationMs, false);

    // Fallback to stale cache
    const stale = listingCache.get(cacheKey);
    if (stale) return { ...stale.data, source: 'cached' };
    return { bills: [], pagination: { count: 0, next: null, prev: null }, source: 'unavailable' };
  }
}

// ═══════════════════════════════════════════════════════════════
// Public API: getApiHealth
// ═══════════════════════════════════════════════════════════════

export function getApiHealth(): ApiHealth {
  const avgLatency = healthState.latencies.length > 0
    ? healthState.latencies.reduce((a, b) => a + b, 0) / healthState.latencies.length
    : 0;

  return {
    isHealthy: healthState.totalRequests === 0 || (healthState.totalSuccesses / healthState.totalRequests) > 0.8,
    lastSuccessAt: healthState.lastSuccessAt,
    lastFailureAt: healthState.lastFailureAt,
    successRate: healthState.totalRequests > 0 ? healthState.totalSuccesses / healthState.totalRequests : 1,
    avgLatencyMs: Math.round(avgLatency),
    isRateLimited: healthState.isRateLimited,
    pendingSyncs: 0,
    totalSynced: healthState.totalSuccesses,
    totalErrors: healthState.totalFailures,
    recentErrors: syncLog.filter((l) => !l.success).slice(-10),
  };
}

// ═══════════════════════════════════════════════════════════════
// Public API: getSyncLog (admin)
// ═══════════════════════════════════════════════════════════════

export function getSyncLog(limit: number = 50): SyncLogEntry[] {
  return syncLog.slice(-limit);
}

// ═══════════════════════════════════════════════════════════════
// Public API: cache management
// ═══════════════════════════════════════════════════════════════

export function getCachedBill(key: CanonicalBillKey): OfficialBillData | null {
  const cached = billCache.get(toCanonicalString(key));
  return cached?.data || null;
}

export function clearCache() {
  billCache.clear();
}

export function getCacheStats() {
  return {
    size: billCache.size,
    keys: Array.from(billCache.keys()),
  };
}
