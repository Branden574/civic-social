// ═══════════════════════════════════════════════════════════════
// Civic Social — AI Bill Summary Generator
// ═══════════════════════════════════════════════════════════════
//
// Generates a plain-language, accessible summary of a bill from
// the official CRS summary text and bill metadata. Designed to
// make legislation understandable for everyday citizens.
//
// With OPENAI_API_KEY: Uses GPT for high-quality plain-language
// rewriting (future enhancement).
// Without: Uses structured extraction and template-based
// rewriting from the CRS text — still highly useful.
//
// RULES:
// - ALL content is derived from the official CRS summary
// - NEVER invents facts not present in the source material
// - Always cites that it is generated from official data
// - Neutral tone — no editorial slant
// ═══════════════════════════════════════════════════════════════

import type { OfficialBillData, OfficialBillStatus } from './types';

// ─── Output shape ────────────────────────────────────────────

export interface AiSummaryResult {
  plainLanguage: string;
  keyProvisions: string[];
  whoIsAffected: string;
  statusPlainText: string;
  generatedAt: string;
  source: 'ai' | 'extracted';
}

// ─── Status → plain English ──────────────────────────────────

const STATUS_PLAIN_TEXT: Record<OfficialBillStatus, string> = {
  introduced:
    'This bill has been introduced and is in the early stages of the legislative process. It needs to be reviewed by committees before it can be voted on.',
  referred_to_committee:
    'This bill has been sent to a congressional committee for review. Committee members will study, discuss, and potentially amend the bill before deciding whether to advance it.',
  reported_by_committee:
    'A committee has finished reviewing this bill and recommended it move forward. It now awaits scheduling for a vote by the full chamber.',
  passed_house:
    'This bill has passed the House of Representatives. It now needs to pass the Senate before it can be sent to the President.',
  passed_senate:
    'This bill has passed the Senate. If the House has already passed a matching version, it goes to the President. Otherwise, differences must be resolved.',
  resolving_differences:
    'The House and Senate have each passed different versions of this bill. A conference committee or further votes are needed to agree on a final version.',
  to_president:
    'Both chambers of Congress have approved this bill. It is now on the President\'s desk awaiting signature or veto.',
  became_law:
    'This bill has been signed into law by the President (or passed over a veto). It is now an active law of the United States.',
  vetoed:
    'The President has vetoed this bill. Congress can attempt to override the veto with a two-thirds vote in both chambers.',
  failed:
    'This bill did not pass. It was either voted down, tabled, or did not receive enough support to advance through the legislative process.',
};

// ─── Text processing helpers ─────────────────────────────────

/**
 * Split CRS summary into meaningful sentences.
 * Handles common CRS formatting quirks.
 */
function splitIntoSentences(text: string): string[] {
  // Protect common abbreviations
  const abbreviations = [
    'U.S.', 'S.', 'H.R.', 'H.J.Res.', 'S.J.Res.', 'H.Con.Res.',
    'S.Con.Res.', 'H.Res.', 'S.Res.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.',
    'Jr.', 'Sr.', 'Inc.', 'Corp.', 'Ltd.', 'Rep.', 'Sen.', 'Gov.',
    'Gen.', 'Col.', 'No.', 'Sec.', 'Art.', 'Dept.', 'Div.', 'i.e.',
    'e.g.', 'etc.', 'vs.', 'v.', 'approx.',
  ];

  let safe = text;
  for (let i = 0; i < abbreviations.length; i++) {
    const escaped = abbreviations[i].replace(/\./g, '\\.');
    safe = safe.replace(new RegExp(escaped, 'g'), `__ABBR${i}__`);
  }

  // CRS summaries often run words together after periods
  safe = safe.replace(/\.([A-Z])/g, '. $1');

  // Split on sentence boundaries
  const raw = safe.split(/(?<=[.!?])\s+/);

  // Restore abbreviations
  return raw
    .map((s) => {
      let restored = s;
      for (let i = 0; i < abbreviations.length; i++) {
        restored = restored.replace(new RegExp(`__ABBR${i}__`, 'g'), abbreviations[i]);
      }
      return restored.trim();
    })
    .filter((s) => s.length > 15);
}

/**
 * Strip the repeated bill title prefix that CRS summaries often start with.
 */
function stripTitlePrefix(text: string): string {
  let cleaned = text;

  // CRS often repeats the full title, then starts with "This bill..."
  const thisIdx = cleaned.indexOf('This bill');
  if (thisIdx > 0 && thisIdx < 250) {
    cleaned = cleaned.slice(thisIdx);
  }

  const theIdx = cleaned.indexOf('The bill');
  if (theIdx > 0 && theIdx < 250 && (thisIdx < 0 || theIdx < thisIdx)) {
    cleaned = cleaned.slice(theIdx);
  }

  return cleaned.trim();
}

/**
 * Convert a CRS provision sentence into a plain-language bullet.
 */
function simplifyProvision(sentence: string): string {
  let s = sentence.trim();

  // Strip CRS boilerplate prefixes
  s = s.replace(/^This bill\s+/i, 'Would ');
  s = s.replace(/^The bill\s+(also\s+)?/i, 'Would ');
  s = s.replace(/^Specifically,?\s*/i, '');
  s = s.replace(/^Additionally,?\s*/i, '');
  s = s.replace(/^Further,?\s*/i, '');
  s = s.replace(/^In addition,?\s*/i, '');

  // Convert third-person "requires" → "Would require"
  const verbMap: Record<string, string> = {
    requires: 'Would require',
    authorizes: 'Would authorize',
    establishes: 'Would establish',
    amends: 'Would amend',
    creates: 'Would create',
    provides: 'Would provide',
    prohibits: 'Would prohibit',
    mandates: 'Would mandate',
    directs: 'Would direct',
    expands: 'Would expand',
    extends: 'Would extend',
    limits: 'Would limit',
    restricts: 'Would restrict',
    increases: 'Would increase',
    decreases: 'Would decrease',
    eliminates: 'Would eliminate',
    revises: 'Would revise',
    repeals: 'Would repeal',
    imposes: 'Would impose',
    permits: 'Would permit',
    designates: 'Would designate',
    appropriates: 'Would appropriate',
    allocates: 'Would allocate',
    sets: 'Would set',
    defines: 'Would define',
    modifies: 'Would modify',
    removes: 'Would remove',
    adds: 'Would add',
    strengthens: 'Would strengthen',
    weakens: 'Would weaken',
    updates: 'Would update',
  };

  const firstWord = s.split(/\s/)[0]?.toLowerCase();
  if (verbMap[firstWord]) {
    s = verbMap[firstWord] + s.slice(firstWord.length);
  }

  // Capitalize first letter
  s = s.charAt(0).toUpperCase() + s.slice(1);

  // Remove trailing period for bullet-point style
  s = s.replace(/\.+$/, '');

  // Cap length for readability
  if (s.length > 200) {
    const cutoff = s.lastIndexOf(' ', 200);
    s = s.slice(0, cutoff > 100 ? cutoff : 200) + '...';
  }

  return s;
}

// ─── Identify affected groups ────────────────────────────────

const AFFECTED_GROUP_PATTERNS: { pattern: RegExp; group: string }[] = [
  { pattern: /\bimmigrante?s?\b/i, group: 'immigrants' },
  { pattern: /\bnon-?citizens?\b|\bnon-?u\.?s\.?\s*nationals?\b|\baliens?\b|\bundocumented\b/i, group: 'non-U.S. nationals' },
  { pattern: /\bveterans?\b/i, group: 'veterans' },
  { pattern: /\bsmall\s*business/i, group: 'small businesses' },
  { pattern: /\bbusiness(es)?\b|\bcorporations?\b|\bcompanies?\b/i, group: 'businesses' },
  { pattern: /\bworkers?\b|\bemployees?\b|\blabor\b/i, group: 'workers and employees' },
  { pattern: /\bstudents?\b/i, group: 'students' },
  { pattern: /\bchildren\b|\bminors?\b|\byouth\b/i, group: 'children and youth' },
  { pattern: /\bseniors?\b|\belderly\b|\bretirees?\b/i, group: 'seniors' },
  { pattern: /\bpatients?\b/i, group: 'patients' },
  { pattern: /\btaxpayers?\b/i, group: 'taxpayers' },
  { pattern: /\bconsumers?\b/i, group: 'consumers' },
  { pattern: /\bfarmers?\b|\bagricultur/i, group: 'farmers and agricultural workers' },
  { pattern: /\bhomeowners?\b|\brenters?\b/i, group: 'homeowners and renters' },
  { pattern: /\blaw\s*enforcement\b|\bpolice\b/i, group: 'law enforcement agencies' },
  { pattern: /\bmilitary\b|\barmed\s*forces\b|\bservice\s*members?\b/i, group: 'military service members' },
  { pattern: /\bhealth\s*care\s*providers?\b|\bdoctors?\b|\bhospitals?\b/i, group: 'healthcare providers' },
  { pattern: /\bteachers?\b|\beducators?\b/i, group: 'educators' },
  { pattern: /\bstate\s*(?:and\s*local\s*)?governments?\b/i, group: 'state and local governments' },
  { pattern: /\bfederal\s*agencies?\b/i, group: 'federal agencies' },
  { pattern: /\btribal\b|\bnative\s*american/i, group: 'tribal communities' },
  { pattern: /\brural\b/i, group: 'rural communities' },
  { pattern: /\burban\b/i, group: 'urban communities' },
];

function identifyAffectedGroups(text: string): string[] {
  const groups: string[] = [];
  const seen = new Set<string>();

  for (const { pattern, group } of AFFECTED_GROUP_PATTERNS) {
    if (pattern.test(text) && !seen.has(group)) {
      groups.push(group);
      seen.add(group);
    }
  }

  return groups;
}

// ─── Build the plain-language opening summary ────────────────

function buildPlainLanguageSummary(
  bill: OfficialBillData,
  sentences: string[],
): string {
  const billCode = bill.billCode;
  const title = bill.shortTitle || bill.officialTitle;

  // Use the first 1-2 meaningful CRS sentences and simplify
  const firstSentence = sentences[0] || '';
  const cleaned = stripTitlePrefix(firstSentence);

  // Transform "This bill..." → plain language
  let opening: string;
  if (cleaned.toLowerCase().startsWith('this bill')) {
    const rest = cleaned.slice('this bill'.length).trim();
    opening = `${billCode} (${title}) is a bill that ${rest}`;
  } else if (cleaned.toLowerCase().startsWith('the bill')) {
    const rest = cleaned.slice('the bill'.length).trim();
    opening = `${billCode} (${title}) is a bill that ${rest}`;
  } else {
    opening = `${billCode} (${title}) — ${cleaned}`;
  }

  // Ensure it ends with a period
  if (!opening.endsWith('.')) opening += '.';

  // Add a second sentence if available for more context
  if (sentences.length > 1) {
    const second = stripTitlePrefix(sentences[1]);
    let simplified = second;
    simplified = simplified.replace(/^This bill\s+(also\s+)?/i, 'It also ');
    simplified = simplified.replace(/^The bill\s+(also\s+)?/i, 'It also ');
    if (!simplified.endsWith('.')) simplified += '.';

    // Capitalize first letter
    simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);

    // Only add if it's meaningfully different and not too long
    if (simplified.length > 20 && simplified.length < 300) {
      opening += ' ' + simplified;
    }
  }

  // Cap overall length
  if (opening.length > 600) {
    const cutoff = opening.lastIndexOf('.', 600);
    if (cutoff > 200) {
      opening = opening.slice(0, cutoff + 1);
    }
  }

  return opening;
}

// ═══════════════════════════════════════════════════════════════
// Main: Generate AI Summary
// ═══════════════════════════════════════════════════════════════

export function generateAiSummary(bill: OfficialBillData): AiSummaryResult | undefined {
  const summary = bill.officialSummary || '';
  const now = new Date().toISOString();

  // No CRS summary — can't generate a meaningful AI summary
  if (!summary || summary.length < 40) {
    // Still provide status explanation and basic info
    return {
      plainLanguage: `${bill.billCode} (${bill.shortTitle || bill.officialTitle}) is currently in the legislative process. A detailed plain-language summary will be available once the Congressional Research Service publishes its official analysis.`,
      keyProvisions: [],
      whoIsAffected: 'Detailed affected-group analysis will be available once the full CRS summary is published.',
      statusPlainText: STATUS_PLAIN_TEXT[bill.status] || 'Status information is currently unavailable.',
      generatedAt: now,
      source: 'extracted',
    };
  }

  // Parse the CRS text
  const sentences = splitIntoSentences(summary);
  const cleanedSummary = stripTitlePrefix(summary);

  // ── 1. Plain-language summary ──────────────────────────
  const plainLanguage = buildPlainLanguageSummary(bill, sentences);

  // ── 2. Key provisions (bullet points) ──────────────────
  // Extract distinct provisions from the CRS summary
  const provisions: string[] = [];
  const seenProvisions = new Set<string>();

  for (const sentence of sentences) {
    const cleaned = stripTitlePrefix(sentence);
    // Skip very short or overly generic sentences
    if (cleaned.length < 30) continue;
    // Skip if it's just restating the title
    if (cleaned.toLowerCase().includes(bill.officialTitle.toLowerCase().slice(0, 40))) continue;

    const simplified = simplifyProvision(cleaned);
    const normalizedKey = simplified.toLowerCase().slice(0, 60);

    if (!seenProvisions.has(normalizedKey)) {
      provisions.push(simplified);
      seenProvisions.add(normalizedKey);
    }

    // Cap at 6 provisions for readability
    if (provisions.length >= 6) break;
  }

  // ── 3. Who is affected ─────────────────────────────────
  const groups = identifyAffectedGroups(cleanedSummary);
  let whoIsAffected: string;

  if (groups.length === 0) {
    whoIsAffected = `This bill primarily affects entities and programs within the ${bill.policyArea || 'federal government'} policy area. The specific groups impacted depend on the detailed provisions of the legislation.`;
  } else if (groups.length === 1) {
    whoIsAffected = `This bill primarily affects ${groups[0]}. The specific impact depends on the detailed provisions and how they are implemented.`;
  } else if (groups.length <= 3) {
    const last = groups.pop()!;
    whoIsAffected = `This bill affects ${groups.join(', ')} and ${last}. Each group may be impacted differently depending on the specific provisions.`;
  } else {
    const top = groups.slice(0, 3);
    const remaining = groups.length - 3;
    const last = top.pop()!;
    whoIsAffected = `This bill affects multiple groups including ${top.join(', ')}, ${last}, and ${remaining} other group${remaining > 1 ? 's' : ''}. The bill's reach spans several policy areas.`;
  }

  // ── 4. Status in plain English ─────────────────────────
  const statusPlainText = STATUS_PLAIN_TEXT[bill.status] || 'Status information is currently unavailable.';

  return {
    plainLanguage,
    keyProvisions: provisions,
    whoIsAffected,
    statusPlainText,
    generatedAt: now,
    source: 'extracted',
  };
}
