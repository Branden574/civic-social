// ═══════════════════════════════════════════════════════════════
// Civic Social — Deterministic Safety Gate + Quality Signals
// ═══════════════════════════════════════════════════════════════
// Pure, dependency-free, server/client safe.
//
// Two responsibilities:
//   1. SAFETY GATE — fast local detection of severe content
//      (threats, hate, dehumanization, doxxing, targeted abuse)
//      with evasion-resistant text normalization.
//   2. QUALITY SIGNALS — constructive-quality scoring inputs
//      (respectfulness, evidence, attacks, rage-bait, …).
//
// Viewpoint-neutrality principles (enforced by tests):
//   * Criticizing politicians, parties, policies, institutions is
//     NEVER more than a low-severity nudge when done without
//     threats/hate/harassment.
//   * Vocabulary associated with one political side (e.g. “deep
//     state”, “illegal aliens”) is a LOW nudge, not a penalty cap.
//   * Slurs/threats/dehumanization are severe regardless of the
//     speaker's politics or politeness.
//   * Educational/reporting mention of a slur is distinguished
//     from use, and downgraded (but still surfaced).
// ═══════════════════════════════════════════════════════════════

import type {
  ModerationIssue,
  ModerationSignals,
  SafetyGateResult,
  ModerationSeverity,
  ModerationCategory,
} from './types';

// ─── Text normalization (evasion resistance) ─────────────────

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
  '+': 't', '€': 'e', '£': 'l',
};

// Common unicode confusables → ascii (small targeted map, not exhaustive)
const CONFUSABLE_MAP: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', // Cyrillic
  'ı': 'i', 'ł': 'l', 'ø': 'o', 'å': 'a', 'ä': 'a', 'ö': 'o',
  'ü': 'u', 'é': 'e', 'è': 'e', 'ê': 'e', 'á': 'a', 'à': 'a',
  'í': 'i', 'ì': 'i', 'ó': 'o', 'ò': 'o', 'ú': 'u', 'ù': 'u',
  'ñ': 'n', 'ç': 'c',
};

/** Strip zero-width and invisible characters used to break up words. */
function stripInvisible(text: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return text.replace(/[​-‏⁠﻿­]/g, '');
}

/**
 * Normalize text for slur/threat matching:
 * lowercase → confusables → leetspeak → collapse repeats →
 * remove symbol injection inside words.
 * Returns both a "loose" form (separators removed) and a "spaced"
 * form (word boundaries kept) since patterns need both.
 */
export function normalizeForMatching(raw: string): {
  spaced: string;
  loose: string;
  /** Rough 0–1 measure of how much normalization changed the text. */
  distance: number;
} {
  const original = raw.toLowerCase();
  let t = stripInvisible(original);

  // Unicode confusables
  t = t.replace(/[^\x20-\x7E]/g, (ch) => CONFUSABLE_MAP[ch] ?? ch);

  // Leetspeak — only inside word-ish runs so prices/years survive ("$5" stays).
  t = t.replace(/[a-z][a-z0-9@$!+€£]*[a-z0-9@$!+€£]/g, (run) =>
    run.replace(/[0-9@$!+€£]/g, (ch) => LEET_MAP[ch] ?? ch),
  );

  // Collapse 3+ repeated chars → 1 ("stuuupid" → "stupid"-ish)
  t = t.replace(/([a-z])\1{2,}/g, '$1');

  // Spaced form: collapse whitespace
  const spaced = t.replace(/\s+/g, ' ').trim();

  // Loose form: remove separators *within* words (h.a.t.e / h-a-t-e / h a t e
  // is handled by removing all non-alphanumerics)
  const loose = t.replace(/[^a-z0-9]/g, '');

  // Normalization distance — proportion of chars changed/removed
  const changed = [...original].filter((ch, i) => spaced[i] !== ch).length;
  const distance = Math.min(1, changed / Math.max(original.length, 1));

  return { spaced, loose, distance };
}

// ─── Severe content patterns ─────────────────────────────────

interface SeverePattern {
  /** Tested against the normalized 'spaced' form. */
  pattern: RegExp;
  /** Also test the 'loose' (separator-stripped) form. */
  testLoose?: RegExp;
  msg: string;
  severity: 'critical' | 'high';
  category: ModerationCategory;
}

// CRITICAL — slurs, credible threats, violent advocacy, doxxing
const CRITICAL_PATTERNS: SeverePattern[] = [
  {
    pattern: /\b(n[i1]gg[ae3]r?s?|sp[i1]c[ks]?|ch[i1]nk[s]?|w[e3]tb[a4]ck[s]?|k[i1]k[e3][s]?|g[o0]{2}k[s]?|r[a4]gh[e3][a4]d[s]?|b[e3][a4]n[e3]r[s]?)\b/,
    testLoose: /(nigger|niggas?|spic|chink|wetback|kike|gook|raghead|beaner)/,
    msg: 'Racial slurs are strictly prohibited — this content violates community standards',
    severity: 'critical',
    category: 'racism',
  },
  {
    pattern: /\b(f[a4]g[gs]?[o0]?t[s]?|tr[a4]nn[yi][e3]?[s]?|d[yi]k[e3][s]?)\b/,
    testLoose: /(faggot|fagot|tranny|trannie)/,
    msg: 'Homophobic and transphobic slurs are strictly prohibited',
    severity: 'critical',
    category: 'hate_speech',
  },
  {
    pattern: /\b(white power|white supremac\w*|master race|racial purity|white nationalis\w*|ethno ?state|race war)\b/,
    msg: 'Supremacist and racial-purity language is prohibited',
    severity: 'critical',
    category: 'racism',
  },
  {
    // Violent advocacy against groups
    pattern: /\b(kill|exterminate|eradicate|genocide|gas|lynch|shoot)\b [^.!?]{0,40}\b(all |the |every )?(blacks?|whites?|asians?|mexicans?|jews?|muslims?|christians?|immigrants?|foreigners?|latinos?|hispanics?|arabs?|gays?|trans (people|folks?)|liberals?|conservatives?|democrats?|republicans?)\b/,
    msg: 'Advocating violence against groups of people is strictly prohibited',
    severity: 'critical',
    category: 'violence',
  },
  {
    // First-person credible threats at individuals
    pattern: /\b(i|we)('| a)?(m|re|ll| will| am going to| gonna)? ?(going to |gonna )?(kill|hurt|shoot|stab|beat up|find and hurt|make (him|her|them|you) pay with blood)\b [^.!?]{0,30}\b(you|him|her|them|this guy|that guy)\b|\b(you|he|she|they) (deserve[s]? to|should) (die|be (shot|killed|hanged|hurt))\b/,
    msg: 'Threats of violence are strictly prohibited',
    severity: 'critical',
    category: 'threat',
  },
  {
    // Doxxing: posting/seeking someone's private location/contact with targeting intent
    pattern: /\b(lives at|home address is|his address|her address|their address|find (him|her|them) at|show up at (his|her|their) (house|home|work)|post(ing)? (his|her|their) (address|phone|info|workplace))\b|\b\d{1,5} [a-z]+ (street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct)\b[^.!?]{0,40}\b(lives?|found|address|house|go|show up)\b/,
    msg: 'Sharing or seeking private addresses or contact details to target someone is prohibited',
    severity: 'critical',
    category: 'doxxing',
  },
];

// HIGH — dehumanization, hate advocacy, targeted harassment campaigns
const HIGH_PATTERNS: SeverePattern[] = [
  {
    pattern: /\b(sub ?humans?|cockroach(es)?|vermin|parasites?)\b [^.!?]{0,40}\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?|refugees?)\b/,
    msg: 'Dehumanizing language toward groups of people is prohibited',
    severity: 'high',
    category: 'hate_speech',
  },
  {
    pattern: /\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?|refugees?)\b [^.!?]{0,40}\b(are )?(sub ?humans?|cockroach(es)?|vermin|parasites?|animals that)\b/,
    msg: 'Dehumanizing language toward groups of people is prohibited',
    severity: 'high',
    category: 'hate_speech',
  },
  {
    pattern: /\b(jew[s]? (control|run|own) (the|all|everything)|protocols? of zion|jewish (conspiracy|agenda) (controls?|runs?))\b/,
    msg: 'Anti-semitic tropes and conspiracy theories are prohibited',
    severity: 'high',
    category: 'hate_speech',
  },
  {
    // Hate advocacy — note: requires advocacy verb + group, NOT policy discussion.
    // "deport all immigrants" = advocacy of collective action based on identity → high.
    // "the deportation policy is wrong/right" = policy talk → untouched.
    pattern: /\b(i |we )?(hate|despise) (all |every )(blacks?|whites?|asians?|mexicans?|jews?|muslims?|christians?|immigrants?|gays?|trans people)\b/,
    msg: 'Advocating hatred against groups of people is prohibited',
    severity: 'high',
    category: 'hate_speech',
  },
  {
    pattern: /\bgo back to (your|their) (country|own country)\b/,
    msg: '“Go back to your country” is xenophobic and discriminatory',
    severity: 'high',
    category: 'racism',
  },
  {
    // Pile-on harassment / abuse campaign organization
    pattern: /\b(everyone (report|flag|spam|dogpile)|let'?s (all )?(report|flag|harass|swarm)|make (his|her|their) life hell|hound (him|her|them) off)\b/,
    msg: 'Organizing harassment campaigns is prohibited',
    severity: 'high',
    category: 'harassment',
  },
];

// Educational / reporting context markers — slur MENTION vs USE
const MENTION_CONTEXT = /\b(called me|called us|called (him|her|them)|was called|been called|the word|the slur|a slur|quoted|screenshot|reported|reporting|in the article|the n-word|hate speech like|examples? of (hate|slurs))\b|["“”'].{0,80}["“”']/;

// ─── Safety gate ─────────────────────────────────────────────

export function runSafetyGate(raw: string): SafetyGateResult {
  const { spaced, loose, distance } = normalizeForMatching(raw);
  const issues: ModerationIssue[] = [];
  let worstSeverity: ModerationSeverity = 'none';
  let worstCategory: ModerationCategory = 'none';
  let evasionDetected = false;
  let mentionContext = false;

  const rank: Record<ModerationSeverity, number> = {
    critical: 4, high: 3, medium: 2, low: 1, none: 0,
  };

  const allSevere = [...CRITICAL_PATTERNS, ...HIGH_PATTERNS];
  for (const p of allSevere) {
    const hitSpaced = p.pattern.test(spaced);
    const hitLoose = !hitSpaced && p.testLoose ? p.testLoose.test(loose) : false;
    if (!hitSpaced && !hitLoose) continue;

    // Loose-only hit = the match only appears once separators/leetspeak are
    // stripped → deliberate evasion attempt. Treat as the full severity AND
    // flag evasion (policy may escalate).
    if (hitLoose) evasionDetected = true;

    let sev: ModerationSeverity = p.severity;
    const isMention = p.category !== 'threat'
      && p.category !== 'doxxing'
      && MENTION_CONTEXT.test(spaced);
    if (isMention && !hitLoose) {
      // Educational/reporting mention: downgrade one notch, still surfaced.
      mentionContext = true;
      sev = p.severity === 'critical' ? 'high' : 'medium';
      issues.push({
        message: 'This appears to quote or report offensive language. Consider censoring the slur (e.g. “n-word”) — quoted slurs still affect readers.',
        severity: sev,
        category: p.category,
      });
    } else {
      issues.push({ message: p.msg, severity: sev, category: p.category });
    }

    if (rank[sev] > rank[worstSeverity]) {
      worstSeverity = sev;
      worstCategory = p.category;
    }
  }

  // Heavy normalization distance + any hit = stronger evasion signal
  if (issues.length > 0 && distance > 0.15) evasionDetected = true;

  return { severity: worstSeverity, category: worstCategory, issues, evasionDetected, mentionContext };
}

// ─── Quality signals ─────────────────────────────────────────

const INSULT_WORDS = /\b(stupid|dumb|idiot|idiots|moron|morons|loser|losers|clown|clowns|fool|fools|pathetic|trash|garbage|worthless|disgusting|scum|filth)\b/gi;
const PROFANITY = /\b(fuck\w*|f\*ck|shit\w*|stfu|gtfo|bullshit|asshole|bitch)\b/gi;
const SECOND_PERSON = /\b(you|your|you're|youre|u)\b/i;
const RAGE_WORDS = /\b(hate|suck|sucks|worst|terrible|horrible|awful|evil|corrupt|destroy|ruin|disgrace)\b/gi;
const EVIDENCE_MARKERS = /\b(source|sources|according to|research (shows|suggests|indicates)|stud(y|ies) (show|found|suggest)|data (shows?|suggests?)|evidence|peer.?reviewed|published|cited|cbo|gao|census|bureau of|\d+(\.\d+)?%|per capita)\b/gi;
const POLICY_TERMS = /\b(policy|policies|bill|bills|legislation|statute|amendment|budget|appropriations?|regulation|regulatory|reform|proposal|tax(es)?|tariffs?|healthcare|medicare|medicaid|immigration|infrastructure|deficit|spending|subsid(y|ies)|committee|congress|senate|house|scotus|supreme court|governor|legislature|ordinance|referendum)\b/gi;
const EMPATHY_MARKERS = /\b(i understand|i appreciate|fair point|good point|you raise|i see (your|the) point|that's reasonable|i hear you|valid concern|i respect)\b/gi;
const SOLUTION_MARKERS = /\b(what if we|we could|a possible approach|one solution|propose|suggest|recommend|alternative would be|compromise|common ground|middle ground|bipartisan)\b/gi;
const HEDGE_MARKERS = /\b(i think|in my view|from my perspective|in my experience|it seems|arguably|i believe|imo|might|perhaps|possibly)\b/gi;
const ABSOLUTIST = /\b(always|never|everyone knows|nobody|no one ever|all of them|every single|wake up|sheeple|open your eyes|do your (own )?research)\b/gi;
const GENERALIZATION = /\b(all|every) (liberals?|conservatives?|republicans?|democrats?|leftists?|right.?wingers?|trump (voters?|supporters?)|biden (voters?|supporters?)) (are|want|think|believe|hate|lie)\b/gi;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeQualitySignals(raw: string): ModerationSignals {
  const text = raw.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = Math.max(words.length, 1);
  const norm = (n: number, per: number) => clamp01(n / Math.max(wc / per, 1));

  const insultCount = countMatches(text, INSULT_WORDS);
  const profanityCount = countMatches(text, PROFANITY);
  const capsRatio = text.replace(/[^A-Z]/g, '').length / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
  const exclaimRuns = (text.match(/!{2,}/g) || []).length;

  // personalAttack: insults aimed at a person (2nd person or named individual nearby)
  const attackBoost = SECOND_PERSON.test(text) && insultCount > 0 ? 0.35 : 0;
  const personalAttack = clamp01(norm(insultCount, 25) * 0.8 + attackBoost);

  // inflammatory: rage lexicon + shouting + exclamation spam
  const rageCount = countMatches(text, RAGE_WORDS);
  const inflammatory = clamp01(
    norm(rageCount, 20) * 0.5
    + (capsRatio > 0.5 && wc >= 3 ? 0.45 : 0)
    + Math.min(exclaimRuns * 0.1, 0.2),
  );

  // rageBait: short + negative + no substance
  const hasSubstance = /\b(because|however|although|policy|issue|think|believe|suggest|source|evidence)\b/i.test(text);
  const rageBait = wc <= 10 && rageCount > 0 && !hasSubstance ? 0.8 : wc <= 16 && rageCount >= 2 && !hasSubstance ? 0.5 : 0;

  const groupGeneralization = clamp01(countMatches(text, GENERALIZATION) * 0.5);
  const absolutism = clamp01(countMatches(text, ABSOLUTIST) * 0.25);

  const evidenceOrientation = clamp01(countMatches(text, EVIDENCE_MARKERS) * 0.3 + (/(https?:\/\/)/.test(text) ? 0.25 : 0));
  const policyFocus = clamp01(countMatches(text, POLICY_TERMS) * 0.22);
  const empathy = clamp01(countMatches(text, EMPATHY_MARKERS) * 0.4);
  const solutionOrientation = clamp01(countMatches(text, SOLUTION_MARKERS) * 0.35);

  // specificity: concrete numbers, proper nouns, policy terms, length
  const numberCount = (text.match(/\b\d[\d,.]*\b/g) || []).length;
  const properNouns = (text.match(/\b[A-Z][a-z]{2,}\b/g) || []).length;
  const specificity = clamp01(numberCount * 0.12 + Math.min(properNouns, 6) * 0.06 + policyFocus * 0.4 + (wc > 25 ? 0.15 : 0));

  // respectfulness: inverse of abuse composite, plus hedging bonus
  const hedges = countMatches(text, HEDGE_MARKERS);
  const respectfulness = clamp01(
    1
    - personalAttack * 0.5
    - norm(profanityCount, 30) * 0.3
    - (capsRatio > 0.5 && wc >= 3 ? 0.2 : 0)
    + Math.min(hedges * 0.05, 0.15),
  );

  return {
    respectfulness,
    specificity,
    evidenceOrientation,
    policyFocus,
    empathy,
    solutionOrientation,
    personalAttack,
    inflammatory,
    absolutism,
    rageBait,
    groupGeneralization,
  };
}

// ─── Medium/low tone issues (viewpoint-neutral) ──────────────

interface ToneRule {
  pattern: RegExp;
  msg: string;
  severity: 'medium' | 'low';
  category: ModerationCategory;
  suggestion?: string;
}

const TONE_RULES: ToneRule[] = [
  // MEDIUM — direct interpersonal abuse (not opinion)
  { pattern: /\b(shut up|stfu)\b/i, msg: 'Telling others to shut up shuts down dialogue', severity: 'medium', category: 'harassment', suggestion: 'Respond to their argument instead — or disengage.' },
  { pattern: /\byou('re| are) (a |an )?(idiot|moron|stupid|dumb|pathetic|trash|garbage|clown|loser)\b/i, msg: 'This is a personal attack on another person', severity: 'medium', category: 'harassment', suggestion: 'Critique the argument, not the person making it.' },
  { pattern: /\b(f\*ck|fuck|stfu|gtfo|bullshit)\b/i, msg: 'Profanity reduces the quality of civic discourse', severity: 'medium', category: 'profanity', suggestion: 'The same point lands harder without profanity.' },

  // LOW — tone nudges, including politically-coded vocabulary.
  // These NEVER cap the score; they only nudge.
  { pattern: /\b(stupid|dumb|idiot|moron|loser|clown|fool)\b/i, msg: 'Consider removing personal insults', severity: 'low', category: 'incivility', suggestion: 'Name the specific decision or policy you disagree with.' },
  { pattern: /\b(illegal aliens?)\b/i, msg: 'Many readers find “illegal alien” dehumanizing', severity: 'low', category: 'incivility', suggestion: 'Consider “undocumented immigrant” — your point will reach more readers.' },
  { pattern: /\b(obviously|clearly|anyone with a brain|common sense says)\b/i, msg: '“Obviously/clearly” can feel condescending', severity: 'low', category: 'incivility', suggestion: 'Explain your reasoning instead of asserting it’s obvious.' },
  { pattern: /\b(do your (own )?research|educate yourself|look it up)\b/i, msg: '“Do your research” is dismissive', severity: 'low', category: 'incivility', suggestion: 'Share the specific source that convinced you.' },
  { pattern: /\b(wake up|sheeple|open your eyes)\b/i, msg: 'This phrasing tends to alienate rather than persuade', severity: 'low', category: 'incivility', suggestion: 'Lead with the evidence that changed your mind.' },
  { pattern: /\b(imagine (being|thinking|believing))\b/i, msg: '“Imagine thinking…” reads as mockery', severity: 'low', category: 'incivility', suggestion: 'State your counterargument directly.' },
  { pattern: /\b(so you're saying|you basically want)\b[^.!?]{0,40}\b(kill|destroy|hate|ruin)\b/i, msg: 'Avoid putting extreme words in others’ mouths (straw-manning)', severity: 'low', category: 'incivility', suggestion: 'Quote what they actually said, then respond to that.' },
  { pattern: /\b(all (liberals|conservatives|republicans|democrats) (want|think|believe|are))\b/i, msg: 'Broad generalizations about political groups reduce nuance', severity: 'low', category: 'incivility', suggestion: 'Name the specific people or faction you mean.' },
  { pattern: /\b(both sides are the same|voting doesn't matter|it's all rigged)\b/i, msg: 'Nihilistic framing discourages civic participation', severity: 'low', category: 'incivility' },
];

export function runToneRules(raw: string): ModerationIssue[] {
  const issues: ModerationIssue[] = [];
  for (const rule of TONE_RULES) {
    if (rule.pattern.test(raw)) {
      issues.push({ message: rule.msg, severity: rule.severity, category: rule.category });
    }
  }
  return issues;
}

export function collectSuggestions(raw: string): string[] {
  const out: string[] = [];
  for (const rule of TONE_RULES) {
    if (rule.suggestion && rule.pattern.test(raw)) out.push(rule.suggestion);
  }
  return out;
}

// Spam-shape detection (hashtag stuffing, link-only, shouting)
export function runSpamChecks(raw: string): ModerationIssue[] {
  const issues: ModerationIssue[] = [];
  const hashtagCount = (raw.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) {
    issues.push({ message: 'Excessive hashtags can look like spam — focus on your message', severity: 'low', category: 'spam' });
  }
  const stripped = raw.replace(/https?:\/\/\S+/g, '').trim();
  if (/(https?:\/\/)/.test(raw) && stripped.length < 10) {
    issues.push({ message: 'Link-only posts get less engagement — add your own take', severity: 'low', category: 'spam' });
  }
  // Shouting: sustained all-caps (not just acronyms). Letter-ratio over the
  // whole text keeps FBI/USA/COVID mentions safe inside normal sentences.
  const letters = raw.replace(/[^a-zA-Z]/g, '');
  const capsRatio = raw.replace(/[^A-Z]/g, '').length / Math.max(letters.length, 1);
  const wc = raw.trim().split(/\s+/).filter(Boolean).length;
  if (capsRatio > 0.6 && wc >= 5) {
    issues.push({ message: 'Sustained capitalization reads as shouting — sentence case lands better', severity: 'low', category: 'incivility' });
  }
  return issues;
}
