import { describe, it, expect } from 'vitest';
import {
  countries,
  parties,
  getPartiesForCountry,
  getPartyById,
  getDefaultParties,
  slugify,
  type Party,
} from '@/lib/data/countries';

// ═══════════════════════════════════════════════════════════════
// Party Deduplication & Normalization Tests
// ═══════════════════════════════════════════════════════════════
//
// These tests enforce the INVARIANT that getPartiesForCountry()
// NEVER returns duplicate parties, across all countries, all edge
// cases, and all entry points.
// ═══════════════════════════════════════════════════════════════

describe('Party Deduplication', () => {
  // ─── Core invariant: no duplicates for any country ─────────

  it('returns zero duplicate names for every registered country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const names = result.map((p) => p.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    }
  });

  it('returns zero duplicate slugs for every registered country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const slugs = result.map((p) => p.slug);
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    }
  });

  it('returns zero duplicate IDs for every registered country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const ids = result.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  // ─── "Independent" appears exactly once ────────────────────

  it('"Independent" appears exactly once for US', () => {
    const result = getPartiesForCountry('US');
    const independents = result.filter((p) => p.name === 'Independent');
    expect(independents).toHaveLength(1);
  });

  it('"Independent" appears exactly once for every country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const independents = result.filter((p) => p.name === 'Independent');
      expect(independents).toHaveLength(1);
    }
  });

  // ─── "Undeclared" appears exactly once ─────────────────────

  it('"Undeclared" appears exactly once for US', () => {
    const result = getPartiesForCountry('US');
    const undeclared = result.filter((p) => p.name === 'Undeclared');
    expect(undeclared).toHaveLength(1);
  });

  it('"Undeclared" appears exactly once for every country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const undeclared = result.filter((p) => p.name === 'Undeclared');
      expect(undeclared).toHaveLength(1);
    }
  });

  // ─── "Multi-affiliation" appears exactly once ──────────────

  it('"Multi-affiliation" appears exactly once for every country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const multi = result.filter((p) => p.name === 'Multi-affiliation');
      expect(multi).toHaveLength(1);
    }
  });

  // ─── Defaults always present ───────────────────────────────

  it('always includes Independent, Undeclared, and Multi-affiliation for any country', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      const names = result.map((p) => p.name);
      expect(names).toContain('Independent');
      expect(names).toContain('Undeclared');
      expect(names).toContain('Multi-affiliation');
    }
  });

  it('returns defaults even for an unknown country code', () => {
    const result = getPartiesForCountry('XX');
    expect(result.length).toBe(3); // only defaults
    const names = result.map((p) => p.name);
    expect(names).toContain('Independent');
    expect(names).toContain('Undeclared');
    expect(names).toContain('Multi-affiliation');
  });

  // ─── Sorting: defaults pinned at end ───────────────────────

  it('sorts defaults at the end of the list', () => {
    const result = getPartiesForCountry('US');
    const lastThree = result.slice(-3);
    expect(lastThree.every((p) => p.isSpecial)).toBe(true);
  });

  it('sorts regular parties alphabetically before defaults', () => {
    const result = getPartiesForCountry('US');
    const regular = result.filter((p) => !p.isSpecial);
    const names = regular.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  // ─── Stability: same result on multiple calls ──────────────

  it('returns identical results on repeated calls (referential stability)', () => {
    const first = getPartiesForCountry('US');
    const second = getPartiesForCountry('US');
    expect(first.map((p) => p.id)).toEqual(second.map((p) => p.id));
    expect(first.map((p) => p.slug)).toEqual(second.map((p) => p.slug));
  });

  // ─── Country change resets cleanly ─────────────────────────

  it('returns different parties when switching countries', () => {
    const us = getPartiesForCountry('US');
    const gb = getPartiesForCountry('GB');
    // Non-default parties should differ between US and GB
    const usRegular = us.filter((p) => !p.isSpecial).map((p) => p.id);
    const gbRegular = gb.filter((p) => !p.isSpecial).map((p) => p.id);
    // No overlap in country-specific IDs
    const overlap = usRegular.filter((id) => gbRegular.includes(id));
    expect(overlap).toHaveLength(0);
  });

  // ─── Each party has a valid slug ───────────────────────────

  it('every party has a non-empty slug', () => {
    for (const party of parties) {
      expect(party.slug).toBeTruthy();
      expect(party.slug.length).toBeGreaterThan(2);
    }
  });

  // ─── Global party index has no duplicate slugs ─────────────

  it('global parties array has no duplicate slugs', () => {
    const slugs = parties.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('global parties array has no duplicate IDs', () => {
    const ids = parties.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('Slugify normalization', () => {
  it('trims and lowercases', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('collapses multiple spaces', () => {
    expect(slugify('Green   Party')).toBe('green-party');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify("People's Democratic Party")).toBe('people-s-democratic-party');
  });

  it('handles accented characters gracefully', () => {
    expect(slugify('Bloc Québécois')).toBe('bloc-qu-b-cois');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('getPartyById', () => {
  it('finds a party by ID', () => {
    const party = getPartyById('us-dem');
    expect(party).toBeDefined();
    expect(party!.name).toBe('Democratic Party');
  });

  it('finds universal defaults by ID', () => {
    const ind = getPartyById('gen-ind');
    expect(ind).toBeDefined();
    expect(ind!.name).toBe('Independent');
    expect(ind!.isSpecial).toBe(true);
  });

  it('returns undefined for unknown ID', () => {
    expect(getPartyById('nonexistent')).toBeUndefined();
  });
});

describe('getDefaultParties', () => {
  it('returns exactly 3 default parties', () => {
    const defaults = getDefaultParties();
    expect(defaults).toHaveLength(3);
  });

  it('all defaults are marked isSpecial', () => {
    const defaults = getDefaultParties();
    expect(defaults.every((p) => p.isSpecial)).toBe(true);
  });

  it('defaults have valid slugs', () => {
    const defaults = getDefaultParties();
    for (const d of defaults) {
      expect(d.slug).toBeTruthy();
    }
  });
});

describe('React key stability (simulates UI rendering)', () => {
  it('every party in a country list has a unique key candidate (slug)', () => {
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      // Simulate React key extraction
      const keys = result.map((p) => p.slug);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    }
  });

  it('no party uses array index as the only differentiator', () => {
    // All parties must have a non-empty, unique slug
    for (const country of countries) {
      const result = getPartiesForCountry(country.code);
      for (const party of result) {
        expect(party.slug).toBeTruthy();
        expect(party.id).toBeTruthy();
      }
    }
  });
});
