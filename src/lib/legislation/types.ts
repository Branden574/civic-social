// ═══════════════════════════════════════════════════════════════
// Civic Social — Legislation Types (Source-of-Truth Model)
// ═══════════════════════════════════════════════════════════════

import type { CanonicalBillKey } from './canonical-key';

// ─── Data source marker ──────────────────────────────────────

export type DataSource =
  | 'congress_api'     // Live from Congress.gov API
  | 'cached'           // From server cache (last known good)
  | 'demo'             // Demonstration/placeholder data — NOT REAL
  | 'unavailable';     // No data available at all

export type SyncStatus =
  | 'live'             // Data freshly synced
  | 'stale'            // Data exists but sync is overdue
  | 'error'            // Sync failed
  | 'demo';            // Using demo data, not real

// ─── Bill status (matches Congress.gov action codes) ─────────

export type OfficialBillStatus =
  | 'introduced'
  | 'referred_to_committee'
  | 'reported_by_committee'
  | 'passed_house'
  | 'passed_senate'
  | 'resolving_differences'
  | 'to_president'
  | 'became_law'
  | 'vetoed'
  | 'failed';

// ─── Legislator (from official data) ─────────────────────────

export interface OfficialSponsor {
  bioguideId: string;        // Official Bioguide ID
  fullName: string;
  party: string;             // "D", "R", "I", etc.
  state: string;
  district?: number;
  isByRequest: boolean;
}

// ─── Legislative action ──────────────────────────────────────

export interface LegislativeAction {
  date: string;              // ISO date string
  text: string;
  type: string;
  actionCode?: string;
  sourceSystem: string;
}

// ─── Cosponsor ───────────────────────────────────────────────

export interface OfficialCosponsor {
  bioguideId: string;
  fullName: string;
  party: string;
  state: string;
  district?: number;
  sponsorshipDate?: string;
}

// ─── Official bill data (normalized from Congress API) ────────

export interface OfficialBillData {
  // ── Identity (canonical, immutable) ──
  canonicalKey: string;      // "US:119:s:2103"
  key: CanonicalBillKey;
  billCode: string;          // "S. 2103" (display format)

  // ── Official metadata ──
  officialTitle: string;     // From Congress.gov — NEVER invented
  shortTitle?: string;       // Official short title if available
  congress: number;
  billType: string;
  billNumber: number;
  originChamber: 'House' | 'Senate';

  // ── Sponsors ──
  sponsor: OfficialSponsor | null;
  cosponsorCount: number;
  cosponsors: OfficialCosponsor[];

  // ── Status & actions ──
  latestAction: LegislativeAction | null;
  actions: LegislativeAction[];      // Full action history
  introducedDate: string;    // ISO date
  status: OfficialBillStatus;
  policyArea?: string;

  // ── Summary (from official CRS summary if available) ──
  officialSummary?: string;  // CRS summary text (HTML stripped)
  officialSummaryHtml?: string; // CRS summary raw HTML
  summarySource?: 'crs' | 'none';
  summaryDate?: string;

  // ── Links (derived from canonical key) ──
  congressGovUrl: string;
  officialTextUrl: string;

  // ── Sync metadata ──
  source: DataSource;
  syncStatus: SyncStatus;
  lastSyncedAt: string;      // ISO timestamp
  lastSyncAttemptAt: string;  // ISO timestamp
  contentHash?: string;       // Hash of bill content for change detection
  syncError?: string;         // Error message if sync failed

  // ── Topics / subjects ──
  subjects: string[];

  // ── AI summary (plain-language explanation generated from CRS) ──
  aiSummary?: {
    plainLanguage: string;       // 2-3 sentence accessible summary
    keyProvisions: string[];     // Bullet-point list of what the bill does
    whoIsAffected: string;       // Who this bill impacts
    statusPlainText: string;     // Status in everyday English
    generatedAt: string;         // ISO timestamp
    source: 'ai' | 'extracted'; // 'ai' if LLM, 'extracted' if rule-based
  };

  // ── Impact analysis (generated from official text) ──
  impactAnalysis?: {
    impacts: {
      category: string;
      icon: string;
      supportersArgue: string;
      criticsArgue: string;
      potentialOutcomes: string[];
    }[];
    generatedAt: string;
    methodology: string;
    sourceDescription: string;
    fromAI: boolean;
  };

  // ── Community (our platform data, not from API) ──
  discussionCount: number;
  followersCount: number;
}

// ─── Bill listing item (lighter type from list endpoint) ─────
// The Congress.gov /bill/{congress} endpoint returns summary-level
// data for each bill. This is much lighter than OfficialBillData
// and is used for the browsable "All Bills" listing.

export interface BillListingItem {
  congress: number;
  number: number;
  type: string;           // "HR", "S", etc. (uppercase from API)
  typeLower: string;      // "hr", "s" (normalized for canonical key)
  title: string;
  originChamber: string;
  originChamberCode: string;
  updateDate: string;     // ISO date
  latestActionDate: string;
  latestActionText: string;
  url: string;            // Congress.gov API URL
  canonicalKey: string;   // Our canonical key format
  displayCode: string;    // "H.R. 1", "S. 5", etc.
}

export interface BillListingResponse {
  bills: BillListingItem[];
  pagination: {
    count: number;        // Total bills available
    next: string | null;
    prev: string | null;
  };
  source: DataSource;
}

// ─── Sync log entry ──────────────────────────────────────────

export interface SyncLogEntry {
  canonicalKey: string;
  timestamp: string;
  success: boolean;
  source: DataSource;
  durationMs: number;
  error?: string;
  httpStatus?: number;
  mismatchDetected?: boolean;
  mismatchDetails?: string;
}

// ─── API health ──────────────────────────────────────────────

export interface ApiHealth {
  isHealthy: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  successRate: number;         // 0-1 over last 100 requests
  avgLatencyMs: number;
  isRateLimited: boolean;
  pendingSyncs: number;
  totalSynced: number;
  totalErrors: number;
  recentErrors: SyncLogEntry[];
}
