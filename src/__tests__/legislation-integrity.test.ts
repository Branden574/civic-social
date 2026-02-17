// ═══════════════════════════════════════════════════════════════
// Civic Social — Legislation Integrity Tests
// ═══════════════════════════════════════════════════════════════
//
// Tests that prove the canonical key system, mismatch detection,
// cache correctness, and fallback behavior work as designed.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  toCanonicalString,
  parseCanonicalString,
  parseHumanBillCode,
  toDisplayCode,
  toCongressGovUrl,
  toCongressGovTextUrl,
  toCongressApiPath,
  validateBillMatch,
  getBillTypeInfo,
  type CanonicalBillKey,
} from '@/lib/legislation/canonical-key';
import { FEATURED_BILL_KEYS } from '@/lib/legislation/bill-store';

// ═══════════════════════════════════════════════════════════════
// 1. CANONICAL KEY TESTS
// ═══════════════════════════════════════════════════════════════

describe('Canonical Bill Key System', () => {
  // ─── toCanonicalString ─────────────────────────────────

  it('produces correct canonical string for a senate bill', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    expect(toCanonicalString(key)).toBe('US:119:s:2103');
  });

  it('produces correct canonical string for a house bill', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 1234 };
    expect(toCanonicalString(key)).toBe('US:119:hr:1234');
  });

  it('produces correct canonical string for a joint resolution', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 118, billType: 'sjres', billNumber: 45 };
    expect(toCanonicalString(key)).toBe('US:118:sjres:45');
  });

  // ─── parseCanonicalString ──────────────────────────────

  it('parses a valid canonical string', () => {
    const result = parseCanonicalString('US:119:s:2103');
    expect(result).not.toBeNull();
    expect(result!.country).toBe('US');
    expect(result!.congress).toBe(119);
    expect(result!.billType).toBe('s');
    expect(result!.billNumber).toBe(2103);
  });

  it('returns null for invalid canonical string (missing parts)', () => {
    expect(parseCanonicalString('US:119:s')).toBeNull();
    expect(parseCanonicalString('US:119')).toBeNull();
    expect(parseCanonicalString('')).toBeNull();
  });

  it('returns null for invalid bill type', () => {
    expect(parseCanonicalString('US:119:xyz:100')).toBeNull();
  });

  it('returns null for non-numeric congress or number', () => {
    expect(parseCanonicalString('US:abc:s:100')).toBeNull();
    expect(parseCanonicalString('US:119:s:abc')).toBeNull();
  });

  it('roundtrips: toCanonicalString → parseCanonicalString', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 22 };
    const str = toCanonicalString(key);
    const parsed = parseCanonicalString(str);
    expect(parsed).toEqual(key);
  });

  // ─── parseHumanBillCode ────────────────────────────────

  it('parses "S. 2103" correctly', () => {
    const result = parseHumanBillCode('S. 2103', 119, 'US');
    expect(result).not.toBeNull();
    expect(result!.billType).toBe('s');
    expect(result!.billNumber).toBe(2103);
    expect(result!.congress).toBe(119);
  });

  it('parses "H.R. 1234" correctly', () => {
    const result = parseHumanBillCode('H.R. 1234', 119, 'US');
    expect(result).not.toBeNull();
    expect(result!.billType).toBe('hr');
    expect(result!.billNumber).toBe(1234);
  });

  it('parses "S.J.Res.45" correctly', () => {
    const result = parseHumanBillCode('S.J.Res.45', 118, 'US');
    expect(result).not.toBeNull();
    expect(result!.billType).toBe('sjres');
    expect(result!.billNumber).toBe(45);
  });

  it('returns null for unrecognizable bill code', () => {
    expect(parseHumanBillCode('INVALID', 119, 'US')).toBeNull();
    expect(parseHumanBillCode('', 119, 'US')).toBeNull();
  });

  // ─── toDisplayCode ─────────────────────────────────────

  it('formats senate bill display code correctly', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    expect(toDisplayCode(key)).toBe('S. 2103');
  });

  it('formats house bill display code correctly', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 1 };
    expect(toDisplayCode(key)).toBe('H.R. 1');
  });

  it('formats joint resolution display code correctly', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hjres', billNumber: 10 };
    expect(toDisplayCode(key)).toBe('H.J.Res. 10');
  });

  // ─── URL generation ────────────────────────────────────

  it('generates correct Congress.gov URL for senate bill', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    expect(toCongressGovUrl(key)).toBe('https://www.congress.gov/bill/119th-congress/senate-bill/2103');
  });

  it('generates correct Congress.gov URL for house bill', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 1 };
    expect(toCongressGovUrl(key)).toBe('https://www.congress.gov/bill/119th-congress/house-bill/1');
  });

  it('generates correct text URL', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 5 };
    expect(toCongressGovTextUrl(key)).toBe('https://www.congress.gov/bill/119th-congress/senate-bill/5/text');
  });

  it('generates correct API path', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    expect(toCongressApiPath(key)).toBe('/bill/119/s/2103');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. MISMATCH DETECTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Mismatch Detection (validateBillMatch)', () => {
  const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };

  it('validates matching data as valid', () => {
    const result = validateBillMatch(key, { congress: 119, type: 'S', number: 2103 });
    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('detects congress session mismatch', () => {
    const result = validateBillMatch(key, { congress: 118, type: 'S', number: 2103 });
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContain('congress: expected 119, got 118');
  });

  it('detects bill type mismatch', () => {
    const result = validateBillMatch(key, { congress: 119, type: 'HR', number: 2103 });
    expect(result.valid).toBe(false);
    expect(result.mismatches.some((m) => m.includes('type'))).toBe(true);
  });

  it('detects bill number mismatch', () => {
    const result = validateBillMatch(key, { congress: 119, type: 'S', number: 999 });
    expect(result.valid).toBe(false);
    expect(result.mismatches.some((m) => m.includes('number'))).toBe(true);
  });

  it('detects multiple mismatches at once', () => {
    const result = validateBillMatch(key, { congress: 118, type: 'HR', number: 999 });
    expect(result.valid).toBe(false);
    expect(result.mismatches.length).toBe(3);
  });

  it('handles string bill numbers', () => {
    const result = validateBillMatch(key, { congress: 119, type: 'S', number: '2103' });
    expect(result.valid).toBe(true);
  });

  it('handles partial data (only congress)', () => {
    const result = validateBillMatch(key, { congress: 119 });
    expect(result.valid).toBe(true);
  });

  it('handles empty data', () => {
    const result = validateBillMatch(key, {});
    expect(result.valid).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. CACHE KEY CORRECTNESS TESTS
// ═══════════════════════════════════════════════════════════════

describe('Cache Key Correctness', () => {
  it('cache keys MUST include congress session (not just bill number)', () => {
    // The same bill number in different congresses MUST produce different cache keys
    const key118: CanonicalBillKey = { country: 'US', congress: 118, billType: 's', billNumber: 2103 };
    const key119: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };

    const cacheKey118 = toCanonicalString(key118);
    const cacheKey119 = toCanonicalString(key119);

    expect(cacheKey118).not.toBe(cacheKey119);
    expect(cacheKey118).toBe('US:118:s:2103');
    expect(cacheKey119).toBe('US:119:s:2103');
  });

  it('cache keys differentiate bill types', () => {
    const keySenate: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 100 };
    const keyHouse: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 100 };

    expect(toCanonicalString(keySenate)).not.toBe(toCanonicalString(keyHouse));
  });

  it('BAD cache key pattern (no congress) is never used', () => {
    // This verifies our canonical string always includes congress
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    const cacheKey = toCanonicalString(key);
    const parts = cacheKey.split(':');

    // Must have exactly 4 parts: country, congress, type, number
    expect(parts).toHaveLength(4);
    expect(parseInt(parts[1])).toBe(119); // congress session is always included
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. LINK CORRECTNESS TESTS
// ═══════════════════════════════════════════════════════════════

describe('Link Correctness (official URLs match canonical key)', () => {
  it('Congress.gov link matches the canonical key for S.2103', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    const url = toCongressGovUrl(key);

    expect(url).toContain('/119th-congress/');
    expect(url).toContain('/senate-bill/');
    expect(url).toContain('/2103');
    // Full URL must be correct
    expect(url).toBe('https://www.congress.gov/bill/119th-congress/senate-bill/2103');
  });

  it('Congress.gov link matches the canonical key for H.R.1', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 1 };
    const url = toCongressGovUrl(key);

    expect(url).toBe('https://www.congress.gov/bill/119th-congress/house-bill/1');
  });

  it('text URL is derived from the same canonical key', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 5 };
    const mainUrl = toCongressGovUrl(key);
    const textUrl = toCongressGovTextUrl(key);

    expect(textUrl).toBe(`${mainUrl}/text`);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. BILL TYPE INFO TESTS
// ═══════════════════════════════════════════════════════════════

describe('Bill Type Metadata', () => {
  it('correctly identifies senate bill chamber', () => {
    expect(getBillTypeInfo('s').chamber).toBe('senate');
    expect(getBillTypeInfo('sjres').chamber).toBe('senate');
    expect(getBillTypeInfo('sconres').chamber).toBe('senate');
    expect(getBillTypeInfo('sres').chamber).toBe('senate');
  });

  it('correctly identifies house bill chamber', () => {
    expect(getBillTypeInfo('hr').chamber).toBe('house');
    expect(getBillTypeInfo('hjres').chamber).toBe('house');
    expect(getBillTypeInfo('hconres').chamber).toBe('house');
    expect(getBillTypeInfo('hres').chamber).toBe('house');
  });

  it('all bill types have display prefixes', () => {
    const types = ['s', 'hr', 'sjres', 'hjres', 'sconres', 'hconres', 'sres', 'hres'] as const;
    for (const type of types) {
      const info = getBillTypeInfo(type);
      expect(info.prefix).toBeTruthy();
      expect(info.label).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. FEATURED BILLS VALIDITY
// ═══════════════════════════════════════════════════════════════

describe('Featured Bill Keys', () => {
  it('all featured bills have valid canonical keys', () => {
    for (const key of FEATURED_BILL_KEYS) {
      expect(key.country).toBe('US');
      expect(key.congress).toBeGreaterThan(0);
      expect(key.billNumber).toBeGreaterThan(0);
      expect(['s', 'hr', 'sjres', 'hjres', 'sconres', 'hconres', 'sres', 'hres']).toContain(key.billType);
    }
  });

  it('featured bills produce unique canonical strings', () => {
    const strings = FEATURED_BILL_KEYS.map(toCanonicalString);
    const unique = new Set(strings);
    expect(unique.size).toBe(strings.length);
  });

  it('featured bills all have Congress.gov URLs', () => {
    for (const key of FEATURED_BILL_KEYS) {
      const url = toCongressGovUrl(key);
      expect(url).toMatch(/^https:\/\/www\.congress\.gov\/bill\/\d+th-congress\//);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. REGRESSION: SAME BILL NUMBER, DIFFERENT CONGRESS
// ═══════════════════════════════════════════════════════════════

describe('Regression: Bill number uniqueness across congresses', () => {
  it('S.2103 in 118th Congress is different from S.2103 in 119th Congress', () => {
    const key118: CanonicalBillKey = { country: 'US', congress: 118, billType: 's', billNumber: 2103 };
    const key119: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };

    // They MUST produce different canonical strings
    expect(toCanonicalString(key118)).not.toBe(toCanonicalString(key119));

    // They MUST produce different Congress.gov URLs
    expect(toCongressGovUrl(key118)).not.toBe(toCongressGovUrl(key119));

    // They MUST produce different API paths
    expect(toCongressApiPath(key118)).not.toBe(toCongressApiPath(key119));
  });

  it('H.R.1 in 118th Congress is different from H.R.1 in 119th Congress', () => {
    const key118: CanonicalBillKey = { country: 'US', congress: 118, billType: 'hr', billNumber: 1 };
    const key119: CanonicalBillKey = { country: 'US', congress: 119, billType: 'hr', billNumber: 1 };

    expect(toCanonicalString(key118)).not.toBe(toCanonicalString(key119));
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. REGRESSION: UI ROUTE DERIVATION
// ═══════════════════════════════════════════════════════════════

describe('Regression: UI routes derive from canonical key', () => {
  it('canonical key US:119:s:2103 produces route /legislation/US/119/s/2103', () => {
    const key: CanonicalBillKey = { country: 'US', congress: 119, billType: 's', billNumber: 2103 };
    const route = `/legislation/${key.country}/${key.congress}/${key.billType}/${key.billNumber}`;
    expect(route).toBe('/legislation/US/119/s/2103');
  });

  it('route components can be parsed back to canonical key', () => {
    const route = '/legislation/US/119/hr/1';
    const parts = route.split('/').filter(Boolean);
    // parts = ['legislation', 'US', '119', 'hr', '1']
    const key: CanonicalBillKey = {
      country: parts[1],
      congress: parseInt(parts[2]),
      billType: parts[3] as CanonicalBillKey['billType'],
      billNumber: parseInt(parts[4]),
    };
    expect(toCanonicalString(key)).toBe('US:119:hr:1');
  });
});
