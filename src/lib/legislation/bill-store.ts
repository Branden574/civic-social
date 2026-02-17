// ═══════════════════════════════════════════════════════════════
// Civic Social — Bill Store
// ═══════════════════════════════════════════════════════════════
//
// Server-side bill data orchestrator. Handles:
// - Fetching + caching bills via the Congress API client
// - Maintaining a "featured bills" list for the tracker dashboard
// - Providing a list of real, currently tracked bills
//
// ═══════════════════════════════════════════════════════════════

import type { CanonicalBillKey } from './canonical-key';
import { toCanonicalString, parseCanonicalString } from './canonical-key';
import { fetchBill } from './congress-api';
import type { OfficialBillData } from './types';

// ─── Featured bills: real bills currently active in Congress ──
// These are real bills from the 119th Congress. Their titles and
// content will be fetched from the official Congress API.

export const FEATURED_BILL_KEYS: CanonicalBillKey[] = [
  // Real bills from the 119th Congress (2025-2026)
  // Each has been verified to return HTTP 200 from Congress.gov API
  { country: 'US', congress: 119, billType: 'hr', billNumber: 1 },     // Reconciliation bill
  { country: 'US', congress: 119, billType: 's', billNumber: 5 },      // Laken Riley Act (Public Law 119-1)
  { country: 'US', congress: 119, billType: 'hr', billNumber: 22 },    // SAVE Act
  { country: 'US', congress: 119, billType: 's', billNumber: 6 },      // Born-Alive Abortion Survivors Protection Act
  { country: 'US', congress: 119, billType: 'hr', billNumber: 2 },     // House bill 2
  { country: 'US', congress: 119, billType: 's', billNumber: 91 },     // Reforming Intelligence and Securing America Act
  { country: 'US', congress: 119, billType: 'hr', billNumber: 29 },    // House bill 29
  { country: 'US', congress: 119, billType: 's', billNumber: 9 },      // Protection of Women and Girls in Sports Act
];

// ─── Fetch all featured bills ────────────────────────────────

export async function fetchFeaturedBills(): Promise<OfficialBillData[]> {
  const results = await Promise.allSettled(
    FEATURED_BILL_KEYS.map((key) => fetchBill(key)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<OfficialBillData> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ─── Fetch a single bill by canonical string ─────────────────

export async function fetchBillByCanonicalString(canonicalStr: string): Promise<OfficialBillData | null> {
  const key = parseCanonicalString(canonicalStr);
  if (!key) return null;
  return fetchBill(key);
}

// ─── Fetch a bill by route params ────────────────────────────

export async function fetchBillByRoute(
  country: string,
  congress: string,
  billType: string,
  billNumber: string,
): Promise<OfficialBillData | null> {
  const c = parseInt(congress, 10);
  const n = parseInt(billNumber, 10);
  if (isNaN(c) || isNaN(n)) return null;

  const key: CanonicalBillKey = {
    country,
    congress: c,
    billType: billType as CanonicalBillKey['billType'],
    billNumber: n,
  };
  return fetchBill(key);
}
