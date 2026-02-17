// ═══════════════════════════════════════════════════════════════
// Civic Social — Canonical Bill Key System
// ═══════════════════════════════════════════════════════════════
//
// A bill identifier MUST be globally unique across congresses.
// Bill numbers repeat across sessions — "S.2103" exists in the
// 118th and 119th congresses with different titles.
//
// Canonical key format:  US:119:s:2103
//   - country_code: "US"
//   - congress_session: 119
//   - bill_type: "s" | "hr" | "sjres" | "hjres" | "sconres" | "hconres" | "sres" | "hres"
//   - bill_number: 2103
//
// UI route:  /legislation/US/119/s/2103
// ═══════════════════════════════════════════════════════════════

export type BillType = 's' | 'hr' | 'sjres' | 'hjres' | 'sconres' | 'hconres' | 'sres' | 'hres';

export interface CanonicalBillKey {
  country: string;       // ISO code, e.g. "US"
  congress: number;      // e.g. 119
  billType: BillType;    // e.g. "s"
  billNumber: number;    // e.g. 2103
}

// ─── Bill type metadata ──────────────────────────────────────

const BILL_TYPE_INFO: Record<BillType, { chamber: 'senate' | 'house'; label: string; prefix: string }> = {
  s:       { chamber: 'senate', label: 'Senate Bill',                   prefix: 'S.' },
  hr:      { chamber: 'house',  label: 'House Bill',                    prefix: 'H.R.' },
  sjres:   { chamber: 'senate', label: 'Senate Joint Resolution',       prefix: 'S.J.Res.' },
  hjres:   { chamber: 'house',  label: 'House Joint Resolution',        prefix: 'H.J.Res.' },
  sconres: { chamber: 'senate', label: 'Senate Concurrent Resolution',  prefix: 'S.Con.Res.' },
  hconres: { chamber: 'house',  label: 'House Concurrent Resolution',   prefix: 'H.Con.Res.' },
  sres:    { chamber: 'senate', label: 'Senate Simple Resolution',      prefix: 'S.Res.' },
  hres:    { chamber: 'house',  label: 'House Simple Resolution',       prefix: 'H.Res.' },
};

// ─── Canonical key → string ──────────────────────────────────

export function toCanonicalString(key: CanonicalBillKey): string {
  return `${key.country}:${key.congress}:${key.billType}:${key.billNumber}`;
}

// ─── String → canonical key ──────────────────────────────────

export function parseCanonicalString(str: string): CanonicalBillKey | null {
  const parts = str.split(':');
  if (parts.length !== 4) return null;

  const [country, congressStr, billType, numberStr] = parts;
  const congress = parseInt(congressStr, 10);
  const billNumber = parseInt(numberStr, 10);

  if (!country || isNaN(congress) || isNaN(billNumber)) return null;
  if (!(billType in BILL_TYPE_INFO)) return null;

  return { country, congress, billType: billType as BillType, billNumber };
}

// ─── Parse human-readable bill code (e.g. "S. 2103") ────────

export function parseHumanBillCode(code: string, congress: number = 119, country: string = 'US'): CanonicalBillKey | null {
  const cleaned = code.trim().replace(/\s+/g, '');

  // Match patterns like "S.2103", "H.R.1234", "S.J.Res.45"
  const patterns: { regex: RegExp; type: BillType }[] = [
    { regex: /^S\.?J\.?Res\.?(\d+)$/i, type: 'sjres' },
    { regex: /^H\.?J\.?Res\.?(\d+)$/i, type: 'hjres' },
    { regex: /^S\.?Con\.?Res\.?(\d+)$/i, type: 'sconres' },
    { regex: /^H\.?Con\.?Res\.?(\d+)$/i, type: 'hconres' },
    { regex: /^S\.?Res\.?(\d+)$/i, type: 'sres' },
    { regex: /^H\.?Res\.?(\d+)$/i, type: 'hres' },
    { regex: /^H\.?R\.?(\d+)$/i, type: 'hr' },
    { regex: /^S\.?(\d+)$/i, type: 's' },
  ];

  for (const { regex, type } of patterns) {
    const match = cleaned.match(regex);
    if (match) {
      return { country, congress, billType: type, billNumber: parseInt(match[1], 10) };
    }
  }

  return null;
}

// ─── Canonical key → human-readable display code ─────────────

export function toDisplayCode(key: CanonicalBillKey): string {
  const info = BILL_TYPE_INFO[key.billType];
  return `${info.prefix} ${key.billNumber}`;
}

// ─── Canonical key → Congress.gov URL ────────────────────────

export function toCongressGovUrl(key: CanonicalBillKey): string {
  const typeMap: Record<BillType, string> = {
    s: 'senate-bill',
    hr: 'house-bill',
    sjres: 'senate-joint-resolution',
    hjres: 'house-joint-resolution',
    sconres: 'senate-concurrent-resolution',
    hconres: 'house-concurrent-resolution',
    sres: 'senate-resolution',
    hres: 'house-resolution',
  };
  const urlType = typeMap[key.billType];
  return `https://www.congress.gov/bill/${key.congress}th-congress/${urlType}/${key.billNumber}`;
}

export function toCongressGovTextUrl(key: CanonicalBillKey): string {
  return `${toCongressGovUrl(key)}/text`;
}

// ─── Canonical key → Congress API path ───────────────────────

export function toCongressApiPath(key: CanonicalBillKey): string {
  return `/bill/${key.congress}/${key.billType}/${key.billNumber}`;
}

// ─── Get bill type info ──────────────────────────────────────

export function getBillTypeInfo(type: BillType) {
  return BILL_TYPE_INFO[type];
}

// ─── Validate canonical key matches fetched data ─────────────

export function validateBillMatch(
  key: CanonicalBillKey,
  fetchedData: { congress?: number; type?: string; number?: number | string },
): { valid: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (fetchedData.congress !== undefined && fetchedData.congress !== key.congress) {
    mismatches.push(`congress: expected ${key.congress}, got ${fetchedData.congress}`);
  }
  if (fetchedData.type !== undefined && fetchedData.type.toLowerCase() !== key.billType) {
    mismatches.push(`type: expected ${key.billType}, got ${fetchedData.type}`);
  }
  const fetchedNumber = typeof fetchedData.number === 'string'
    ? parseInt(fetchedData.number, 10)
    : fetchedData.number;
  if (fetchedNumber !== undefined && fetchedNumber !== key.billNumber) {
    mismatches.push(`number: expected ${key.billNumber}, got ${fetchedNumber}`);
  }

  return { valid: mismatches.length === 0, mismatches };
}
