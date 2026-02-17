// ═══════════════════════════════════════════════════════════════
// Civic Social — Country & Political Party Registry
// ═══════════════════════════════════════════════════════════════
//
// INVARIANT: getPartiesForCountry() must NEVER return duplicates.
//
// Dedup pipeline (deterministic):
//   1. Collect country-specific parties
//   2. Collect universal defaults (country='*')
//   3. Normalize names (trim, collapse spaces, lowercase slug)
//   4. Deduplicate by slug — country-specific wins over universal
//   5. Append any universal defaults that don't collide
//   6. Sort: regular parties alphabetically, then defaults pinned to end
//
// ═══════════════════════════════════════════════════════════════

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface Party {
  id: string;
  name: string;
  abbreviation: string;
  country: string;        // ISO code or '*' for universal defaults
  ideology: string;
  color: string;
  isSpecial?: boolean;    // true for Independent / Undeclared / Multi-affiliation
  slug: string;           // normalized unique key: "<country>:<lowercase-name>"
  source?: 'registry' | 'default'; // origin of the record
}

// ─── Countries ───────────────────────────────────────────────

export const countries: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
];

// ─── Normalization helpers ───────────────────────────────────

/**
 * Create a deterministic slug from a party name.
 * Trims, collapses whitespace, lowercases, replaces non-alphanumeric with hyphens.
 */
function slugify(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')         // collapse multiple spaces
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // non-alphanumeric → hyphen
    .replace(/^-|-$/g, '');        // strip leading/trailing hyphens
}

/**
 * Normalize a party name for display: trim + collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// ─── Raw party data (internal, not exported) ─────────────────
// Country-specific parties should NOT duplicate universal defaults.
// Only list actual political parties here; "Independent", "Undeclared",
// and "Multi-affiliation" are handled exclusively via UNIVERSAL_DEFAULTS.

interface RawParty {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  ideology: string;
  color: string;
  isSpecial?: boolean;
}

const RAW_PARTIES: RawParty[] = [
  // ── United States ──
  { id: 'us-dem', name: 'Democratic Party', abbreviation: 'DEM', country: 'US', ideology: 'center-left', color: '#3B82F6' },
  { id: 'us-rep', name: 'Republican Party', abbreviation: 'GOP', country: 'US', ideology: 'center-right', color: '#EF4444' },
  { id: 'us-lib', name: 'Libertarian Party', abbreviation: 'LIB', country: 'US', ideology: 'right', color: '#F59E0B' },
  { id: 'us-grn', name: 'Green Party', abbreviation: 'GRN', country: 'US', ideology: 'left', color: '#10B981' },

  // ── United Kingdom ──
  { id: 'gb-con', name: 'Conservative Party', abbreviation: 'CON', country: 'GB', ideology: 'center-right', color: '#3B82F6' },
  { id: 'gb-lab', name: 'Labour Party', abbreviation: 'LAB', country: 'GB', ideology: 'center-left', color: '#EF4444' },
  { id: 'gb-lib', name: 'Liberal Democrats', abbreviation: 'LD', country: 'GB', ideology: 'center', color: '#F59E0B' },
  { id: 'gb-grn', name: 'Green Party', abbreviation: 'GRN', country: 'GB', ideology: 'left', color: '#10B981' },
  { id: 'gb-ref', name: 'Reform UK', abbreviation: 'REF', country: 'GB', ideology: 'right', color: '#06B6D4' },

  // ── Canada ──
  { id: 'ca-lib', name: 'Liberal Party', abbreviation: 'LPC', country: 'CA', ideology: 'center-left', color: '#EF4444' },
  { id: 'ca-con', name: 'Conservative Party', abbreviation: 'CPC', country: 'CA', ideology: 'center-right', color: '#3B82F6' },
  { id: 'ca-ndp', name: 'New Democratic Party', abbreviation: 'NDP', country: 'CA', ideology: 'left', color: '#F97316' },
  { id: 'ca-grn', name: 'Green Party', abbreviation: 'GPC', country: 'CA', ideology: 'left', color: '#10B981' },
  { id: 'ca-bq', name: 'Bloc Québécois', abbreviation: 'BQ', country: 'CA', ideology: 'center-left', color: '#06B6D4' },

  // ── Australia ──
  { id: 'au-alp', name: 'Australian Labor Party', abbreviation: 'ALP', country: 'AU', ideology: 'center-left', color: '#EF4444' },
  { id: 'au-lib', name: 'Liberal Party', abbreviation: 'LIB', country: 'AU', ideology: 'center-right', color: '#3B82F6' },
  { id: 'au-nat', name: 'National Party', abbreviation: 'NAT', country: 'AU', ideology: 'center-right', color: '#10B981' },
  { id: 'au-grn', name: 'Australian Greens', abbreviation: 'GRN', country: 'AU', ideology: 'left', color: '#22C55E' },

  // ── Germany ──
  { id: 'de-spd', name: 'Social Democratic Party', abbreviation: 'SPD', country: 'DE', ideology: 'center-left', color: '#EF4444' },
  { id: 'de-cdu', name: 'Christian Democratic Union', abbreviation: 'CDU', country: 'DE', ideology: 'center-right', color: '#1F2937' },
  { id: 'de-grn', name: 'Alliance 90/The Greens', abbreviation: 'GRN', country: 'DE', ideology: 'left', color: '#10B981' },
  { id: 'de-fdp', name: 'Free Democratic Party', abbreviation: 'FDP', country: 'DE', ideology: 'center', color: '#F59E0B' },
  { id: 'de-afd', name: 'Alternative for Germany', abbreviation: 'AfD', country: 'DE', ideology: 'right', color: '#3B82F6' },

  // ── France ──
  { id: 'fr-ren', name: 'Renaissance', abbreviation: 'RE', country: 'FR', ideology: 'center', color: '#F59E0B' },
  { id: 'fr-rn', name: 'National Rally', abbreviation: 'RN', country: 'FR', ideology: 'right', color: '#1F2937' },
  { id: 'fr-lfi', name: 'La France Insoumise', abbreviation: 'LFI', country: 'FR', ideology: 'left', color: '#EF4444' },
  { id: 'fr-lr', name: 'Les Républicains', abbreviation: 'LR', country: 'FR', ideology: 'center-right', color: '#3B82F6' },
  { id: 'fr-eelv', name: 'Europe Ecology – The Greens', abbreviation: 'EELV', country: 'FR', ideology: 'left', color: '#10B981' },

  // ── India ──
  { id: 'in-bjp', name: 'Bharatiya Janata Party', abbreviation: 'BJP', country: 'IN', ideology: 'center-right', color: '#F97316' },
  { id: 'in-inc', name: 'Indian National Congress', abbreviation: 'INC', country: 'IN', ideology: 'center-left', color: '#06B6D4' },
  { id: 'in-aap', name: 'Aam Aadmi Party', abbreviation: 'AAP', country: 'IN', ideology: 'center', color: '#3B82F6' },

  // ── Brazil ──
  { id: 'br-pt', name: 'Workers Party', abbreviation: 'PT', country: 'BR', ideology: 'left', color: '#EF4444' },
  { id: 'br-pl', name: 'Liberal Party', abbreviation: 'PL', country: 'BR', ideology: 'right', color: '#3B82F6' },
  { id: 'br-mdb', name: 'Brazilian Democratic Movement', abbreviation: 'MDB', country: 'BR', ideology: 'center', color: '#10B981' },

  // ── Nigeria ──
  { id: 'ng-apc', name: 'All Progressives Congress', abbreviation: 'APC', country: 'NG', ideology: 'center-right', color: '#3B82F6' },
  { id: 'ng-pdp', name: "People's Democratic Party", abbreviation: 'PDP', country: 'NG', ideology: 'center-left', color: '#EF4444' },
  { id: 'ng-lp', name: 'Labour Party', abbreviation: 'LP', country: 'NG', ideology: 'left', color: '#10B981' },

  // ── Japan ──
  { id: 'jp-ldp', name: 'Liberal Democratic Party', abbreviation: 'LDP', country: 'JP', ideology: 'center-right', color: '#3B82F6' },
  { id: 'jp-cdp', name: 'Constitutional Democratic Party', abbreviation: 'CDP', country: 'JP', ideology: 'center-left', color: '#EF4444' },
  { id: 'jp-ishin', name: 'Nippon Ishin no Kai', abbreviation: 'ISHIN', country: 'JP', ideology: 'center', color: '#10B981' },

  // ── South Korea ──
  { id: 'kr-ppp', name: "People Power Party", abbreviation: 'PPP', country: 'KR', ideology: 'center-right', color: '#EF4444' },
  { id: 'kr-dpk', name: 'Democratic Party of Korea', abbreviation: 'DPK', country: 'KR', ideology: 'center-left', color: '#3B82F6' },

  // ── Mexico ──
  { id: 'mx-morena', name: 'MORENA', abbreviation: 'MORENA', country: 'MX', ideology: 'left', color: '#8B0000' },
  { id: 'mx-pan', name: 'National Action Party', abbreviation: 'PAN', country: 'MX', ideology: 'center-right', color: '#3B82F6' },
  { id: 'mx-pri', name: 'Institutional Revolutionary Party', abbreviation: 'PRI', country: 'MX', ideology: 'center', color: '#10B981' },

  // ── South Africa ──
  { id: 'za-anc', name: 'African National Congress', abbreviation: 'ANC', country: 'ZA', ideology: 'center-left', color: '#10B981' },
  { id: 'za-da', name: 'Democratic Alliance', abbreviation: 'DA', country: 'ZA', ideology: 'center', color: '#3B82F6' },
  { id: 'za-eff', name: 'Economic Freedom Fighters', abbreviation: 'EFF', country: 'ZA', ideology: 'left', color: '#EF4444' },

  // ── Kenya ──
  { id: 'ke-uda', name: 'United Democratic Alliance', abbreviation: 'UDA', country: 'KE', ideology: 'center-right', color: '#F59E0B' },
  { id: 'ke-odm', name: 'Orange Democratic Movement', abbreviation: 'ODM', country: 'KE', ideology: 'center-left', color: '#F97316' },
];

// ─── Universal defaults (always available, exactly once) ─────
// These are the ONLY source for "Independent", "Undeclared", "Multi-affiliation".
// Country-specific entries MUST NOT duplicate these names.

const UNIVERSAL_DEFAULTS: RawParty[] = [
  { id: 'gen-ind', name: 'Independent', abbreviation: 'IND', country: '*', ideology: 'center', color: '#8B5CF6', isSpecial: true },
  { id: 'gen-und', name: 'Undeclared', abbreviation: 'UND', country: '*', ideology: 'center', color: '#6B7280', isSpecial: true },
  { id: 'gen-mul', name: 'Multi-affiliation', abbreviation: 'MUL', country: '*', ideology: 'center', color: '#A78BFA', isSpecial: true },
];

// ─── Build the normalized party index ────────────────────────

function buildParty(raw: RawParty): Party {
  const name = normalizeName(raw.name);
  return {
    ...raw,
    name,
    slug: `${raw.country}:${slugify(name)}`,
    source: raw.isSpecial ? 'default' : 'registry',
  };
}

/**
 * Pre-built lookup: Map<slug, Party> for all parties.
 * Guarantees uniqueness by slug at the data layer.
 */
const PARTY_INDEX: Map<string, Party> = (() => {
  const map = new Map<string, Party>();
  for (const raw of [...RAW_PARTIES, ...UNIVERSAL_DEFAULTS]) {
    const party = buildParty(raw);
    // If slug already exists, first write wins (no silent override)
    if (!map.has(party.slug)) {
      map.set(party.slug, party);
    }
  }
  return map;
})();

/**
 * All parties (deduplicated). Exported for testing and admin views.
 */
export const parties: Party[] = Array.from(PARTY_INDEX.values());

// ═══════════════════════════════════════════════════════════════
// Public API — getPartiesForCountry
// ═══════════════════════════════════════════════════════════════
//
// Returns a DEDUPLICATED, SORTED list for a given country code.
//
// Pipeline:
//   1. Filter country-specific parties
//   2. Normalize names for collision detection
//   3. Add universal defaults IFF no country-specific party has the same name
//   4. Sort: regular parties alphabetically, defaults pinned at the end
//
// ═══════════════════════════════════════════════════════════════

export function getPartiesForCountry(countryCode: string): Party[] {
  // Step 1: Collect country-specific parties
  const countryParties = parties.filter((p) => p.country === countryCode);

  // Step 2: Build a set of normalized names already present
  const nameSet = new Set(countryParties.map((p) => slugify(p.name)));

  // Step 3: Add universal defaults that don't collide by name
  const defaults = parties.filter((p) => p.country === '*');
  const nonCollidingDefaults = defaults.filter((d) => !nameSet.has(slugify(d.name)));

  // Step 4: Merge
  const merged = [...countryParties, ...nonCollidingDefaults];

  // Step 5: Final dedup safety net — use a Map keyed on normalized name
  // This catches any edge case (e.g., API returning "independent" with different casing)
  const deduped = new Map<string, Party>();
  for (const party of merged) {
    const key = slugify(party.name);
    if (!deduped.has(key)) {
      deduped.set(key, party);
    }
    // else: skip — first occurrence wins (country-specific > universal)
  }

  // Step 6: Sort — regular parties alphabetically, then defaults pinned at end
  const result = Array.from(deduped.values());
  result.sort((a, b) => {
    // Defaults always last
    if (a.isSpecial && !b.isSpecial) return 1;
    if (!a.isSpecial && b.isSpecial) return -1;
    // Among same type, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  return result;
}

// ─── Utility exports ─────────────────────────────────────────

export function getPartyById(id: string): Party | undefined {
  for (const party of PARTY_INDEX.values()) {
    if (party.id === id) return party;
  }
  return undefined;
}

export function getIdeologyColor(ideology: string): string {
  const map: Record<string, string> = {
    'left': '#60A5FA',
    'center-left': '#818CF8',
    'center': '#A78BFA',
    'center-right': '#FB923C',
    'right': '#F87171',
  };
  return map[ideology] || '#6B7280';
}

/**
 * Returns only the universal default parties.
 * Use as fallback when an API call fails.
 */
export function getDefaultParties(): Party[] {
  return UNIVERSAL_DEFAULTS.map(buildParty);
}

/**
 * Exposed for testing: the slugify function.
 */
export { slugify };
