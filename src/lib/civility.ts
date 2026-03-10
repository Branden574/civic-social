// ═══════════════════════════════════════════════════════════════
// Civic Social — Civility Analyzer (shared, server + client safe)
// ═══════════════════════════════════════════════════════════════
// Pure function — no React, no browser APIs. Can be imported in
// both API routes (server-side scoring) and client components.
//
// Severity model:
//   - CRITICAL (slurs, hate speech, violence): score capped at 0.05
//   - HIGH (harassment, dehumanization): score capped at 0.15
//   - MEDIUM (hostility, profanity): additive penalties
//   - LOW (passive aggression, low-effort): additive penalties
//
// In production: replace with a fine-tuned LLM classifier.
// ═══════════════════════════════════════════════════════════════

export interface CivilityResult {
  score: number;   // 0–1, higher is more civil
  issues: string[];
  /** Severity classification: 'critical' | 'high' | 'medium' | 'low' | 'none' */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  /** Category of worst violation detected */
  category: 'racism' | 'hate_speech' | 'violence' | 'harassment' | 'profanity' | 'incivility' | 'none';
}

// ── Severity-classified patterns ────────────────────────────────

interface SeverityPattern {
  pattern: RegExp;
  msg: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: CivilityResult['category'];
}

// CRITICAL: Racial slurs, hate speech, violent threats — score floor 0.05
const CRITICAL_PATTERNS: SeverityPattern[] = [
  // Racial slurs
  { pattern: /\b(n[i1]gg[ae3]r?s?|n[i1]gg[ae3]h?|sp[i1]c[ks]?|ch[i1]nk[s]?|w[e3]tb[a4]ck[s]?|k[i1]k[e3][s]?|g[o0]{2}k[s]?|r[a4]gh[e3][a4]d[s]?|c[o0]{2}n[s]?|b[e3][a4]n[e3]r[s]?)\b/i, msg: 'Racial slurs are strictly prohibited — this content violates community standards', severity: 'critical', category: 'racism' },
  // Homophobic/transphobic slurs
  { pattern: /\b(f[a4]g[gs]?[o0]?t[s]?|tr[a4]nn[yi1][e3]?[s]?|d[yi1]k[e3][s]?)\b/i, msg: 'Homophobic and transphobic slurs are strictly prohibited', severity: 'critical', category: 'hate_speech' },
  // Supremacist language
  { pattern: /\b(white\s*power|white\s*supremac|master\s*race|racial?\s*purity|white\s*nationalist|ethno\s*state|race\s*war)\b/i, msg: 'White supremacist and racial supremacy language is prohibited', severity: 'critical', category: 'racism' },
  // Violent threats against groups
  { pattern: /\b(kill|exterminate|eradicate|genocide)\s+(all\s+)?(blacks?|whites?|asians?|mexicans?|jews?|muslims?|immigrants?|foreigners?|latinos?|hispanics?|arabs?)\b/i, msg: 'Advocating violence against racial/ethnic groups is strictly prohibited', severity: 'critical', category: 'violence' },
  // Direct violent threats
  { pattern: /\b(kill|die|death to|destroy)\b.*\b(them|him|her|you)\b/i, msg: 'Violent language is not permitted', severity: 'critical', category: 'violence' },
];

// HIGH: Dehumanization, hate advocacy, severe discrimination — score floor 0.15
const HIGH_PATTERNS: SeverityPattern[] = [
  // Dehumanization based on identity
  { pattern: /\b(sub\s*human|animals?|savages?|cockroach|vermin|infestation|invasion)\b.*\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?)\b/i, msg: 'Dehumanizing language toward racial or ethnic groups is prohibited', severity: 'high', category: 'hate_speech' },
  { pattern: /\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?)\b.*\b(sub\s*human|animals?|savages?|cockroach|vermin|infestation|invasion)\b/i, msg: 'Dehumanizing language toward racial or ethnic groups is prohibited', severity: 'high', category: 'hate_speech' },
  // Anti-semitic tropes
  { pattern: /\b(jew[s]?\s*(control|run|own)|zionist?\s*occupation|protocols?\s*of\s*zion|jewish\s*(conspiracy|agenda|lobby))\b/i, msg: 'Anti-semitic tropes and conspiracy theories are prohibited', severity: 'high', category: 'hate_speech' },
  // Islamophobic generalization
  { pattern: /\b(all\s*muslims?\s*(are|should)|ban\s*islam|muslim\s*ban|islamic?\s*invasion|creeping\s*sharia)\b/i, msg: 'Islamophobic generalizations are discriminatory', severity: 'high', category: 'hate_speech' },
  // Xenophobic commands
  { pattern: /\b(go\s*back\s*to\s*(your|their)\s*(country|where))\b/i, msg: '"Go back to your country" is xenophobic and discriminatory', severity: 'high', category: 'racism' },
  // Hate advocacy
  { pattern: /\b(hate|deport)\s+(all\s+)?(blacks?|whites?|asians?|mexicans?|jews?|muslims?|immigrants?|foreigners?|latinos?|hispanics?|arabs?)\b/i, msg: 'Advocating hatred against racial/ethnic groups is strictly prohibited', severity: 'high', category: 'hate_speech' },
];

// MEDIUM: Hostility, profanity, personal attacks — additive penalties
const MEDIUM_PATTERNS: SeverityPattern[] = [
  { pattern: /\b(stupid|dumb|idiot|moron|loser|clown|fool)\b/i, msg: 'Consider removing personal insults', severity: 'medium', category: 'harassment' },
  { pattern: /\b(shut up|you people|those people|these people)\b/i, msg: '"You/those people" language can feel dismissive and othering', severity: 'medium', category: 'harassment' },
  { pattern: /\b(trash|garbage|worthless|disgusting)\b/i, msg: 'Strongly derogatory language reduces constructive dialogue', severity: 'medium', category: 'harassment' },
  { pattern: /\bi\s+hate\b/i, msg: 'Expressing hatred is not constructive — focus on specific policy disagreements', severity: 'medium', category: 'incivility' },
  { pattern: /\b(hate|despise|loathe)\s+\w+/i, msg: 'Expressing hatred toward people or groups shuts down dialogue', severity: 'medium', category: 'incivility' },
  { pattern: /\b(f\*ck|fuck|fk|stfu|gtfo|bs|bullshit|damn|hell)\b/i, msg: 'Profanity reduces the quality of civic discourse', severity: 'medium', category: 'profanity' },
  { pattern: /\b(worst|terrible|horrible|awful)\s+(president|person|human|leader|politician)\b/i, msg: 'Personal attacks on character are less constructive than policy critique', severity: 'medium', category: 'incivility' },
  { pattern: /\b(those\s+people\s+are\s+(all|always|never|just))\b/i, msg: 'Blanket negative generalizations about groups are discriminatory', severity: 'medium', category: 'incivility' },
  { pattern: /\b(illegal\s*alien[s]?)\b/i, msg: '"Illegal alien" is dehumanizing — use "undocumented immigrant" instead', severity: 'medium', category: 'incivility' },
  // Conspiracy rhetoric
  { pattern: /\b(wake up|sheep|sheeple|open your eyes)\b/i, msg: 'This phrasing is associated with conspiracy rhetoric', severity: 'medium', category: 'incivility' },
  { pattern: /\b(they don't want you to know|mainstream media lies|msm)\b/i, msg: 'Blanket media distrust claims need specific evidence', severity: 'medium', category: 'incivility' },
  { pattern: /\b(deep state|cabal|plandemic|hoax)\b/i, msg: 'Conspiracy-associated language reduces credibility', severity: 'medium', category: 'incivility' },
  { pattern: /\b(globalist|elites? control|shadow government)\b/i, msg: 'This language is often associated with conspiracy narratives', severity: 'medium', category: 'incivility' },
];

// LOW: Passive aggression, straw-manning, mild issues — small penalties
const LOW_PATTERNS: SeverityPattern[] = [
  { pattern: /\b(obviously|clearly|anyone with a brain|common sense)\b/i, msg: '"Obviously/clearly" can feel condescending — explain your reasoning instead', severity: 'low', category: 'incivility' },
  { pattern: /\b(I'm not surprised|typical|what did you expect)\b/i, msg: 'This can come across as dismissive — consider engaging with the substance', severity: 'low', category: 'incivility' },
  { pattern: /\b(do your (own )?research|educate yourself|look it up)\b/i, msg: '"Do your research" is dismissive — share specific sources instead', severity: 'low', category: 'incivility' },
  { pattern: /\b(must be nice|good luck with that|sure,? buddy)\b/i, msg: 'Sarcasm can undermine good-faith discussion', severity: 'low', category: 'incivility' },
  { pattern: /\b(imagine (being|thinking|believing))\b/i, msg: '"Imagine thinking..." is often used to mock — consider a direct response', severity: 'low', category: 'incivility' },
  { pattern: /\blol\b.*\b(imagine|literally|can't even)\b/i, msg: "Mockery doesn't contribute to constructive discourse", severity: 'low', category: 'incivility' },
  { pattern: /\b(so you're saying|you basically want|you think that)\b.*\b(kill|destroy|hate|ruin)\b/i, msg: "Avoid putting extreme words in others' mouths (straw-manning)", severity: 'low', category: 'incivility' },
  { pattern: /\b(all (liberals|conservatives|republicans|democrats) (want|think|believe|are))\b/i, msg: 'Broad generalizations about political groups reduce nuance', severity: 'low', category: 'incivility' },
  { pattern: /\b(the (left|right) always)\b/i, msg: 'Attributing behavior to an entire side oversimplifies complex issues', severity: 'low', category: 'incivility' },
  { pattern: /\b(both sides are the same|it's all rigged|voting doesn't matter)\b/i, msg: 'Nihilistic framing discourages civic participation', severity: 'low', category: 'incivility' },
];

// Penalty amounts by severity
const SEVERITY_PENALTIES: Record<string, number> = {
  critical: 0.95,  // score → 0.05 on first match
  high: 0.85,      // score → 0.15 on first match
  medium: 0.18,    // additive
  low: 0.09,       // additive
};

// Score ceilings — if ANY pattern of this severity matches, score cannot exceed this
const SEVERITY_CEILINGS: Record<string, number> = {
  critical: 0.05,
  high: 0.15,
};

// ── Main analyzer ────────────────────────────────────────────────

export function analyzeCivility(text: string): CivilityResult {
  const issues: string[] = [];
  let score = 1.0;
  let worstSeverity: CivilityResult['severity'] = 'none';
  let worstCategory: CivilityResult['category'] = 'none';

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { score: 1, issues: [], severity: 'none', category: 'none' };
  }

  // Severity priority order: check critical first
  const severityOrder: ['critical', 'high', 'medium', 'low'] = ['critical', 'high', 'medium', 'low'];
  const patternGroups = [CRITICAL_PATTERNS, HIGH_PATTERNS, MEDIUM_PATTERNS, LOW_PATTERNS];

  for (let i = 0; i < severityOrder.length; i++) {
    const severity = severityOrder[i];
    const patterns = patternGroups[i];

    for (const { pattern, msg, category } of patterns) {
      if (pattern.test(lower)) {
        const penalty = SEVERITY_PENALTIES[severity];
        score -= penalty;
        issues.push(msg);

        // Track worst severity/category
        if (severityOrder.indexOf(severity) < severityOrder.indexOf(worstSeverity === 'none' ? 'low' : worstSeverity) || worstSeverity === 'none') {
          worstSeverity = severity;
          worstCategory = category;
        }
      }
    }
  }

  // Apply score ceilings for severe violations
  if (worstSeverity === 'critical') {
    score = Math.min(score, SEVERITY_CEILINGS.critical);
  } else if (worstSeverity === 'high') {
    score = Math.min(score, SEVERITY_CEILINGS.high);
  }

  // ── All-caps detection ──────────────────────────────────
  const capsRatio = (text.replace(/[^A-Z]/g, '').length) / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
  if (capsRatio > 0.5 && wordCount >= 3) {
    score -= 0.2;
    issues.push('Excessive capitalization can read as shouting');
  }

  // ── Exclamation spam ────────────────────────────────────
  if (/!!!+/g.test(text)) {
    score -= 0.10;
    issues.push('Multiple exclamation marks can seem aggressive');
  }

  // ── Low-effort inflammatory content ─────────────────────
  if (wordCount <= 8) {
    const hasNegative = /\b(hate|suck|worst|terrible|horrible|awful|stupid|dumb|trash|garbage|evil|corrupt)\b/i.test(lower);
    const hasConstructive = /\b(because|however|although|policy|issue|think|believe|suggest|source)\b/i.test(lower);
    if (hasNegative && !hasConstructive) {
      score -= 0.15;
      issues.push('Short inflammatory posts lack substance — add reasoning or evidence');
    }
  }

  // ── Readability check ───────────────────────────────────
  if (wordCount > 30) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
    if (avgSentenceLength > 40) {
      score -= 0.05;
      issues.push('Very long sentences can be hard to follow — consider breaking them up');
    }
  }

  // ── Excessive hashtag stuffing ──────────────────────────
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) {
    score -= 0.08;
    issues.push('Excessive hashtags can look like spam — focus on your message');
  }

  // ── Constructive discourse bonuses ─────────────────────
  // IMPORTANT: Bonuses cannot override severity ceilings
  const constructivePatterns = [
    { pattern: /\b(I think|in my view|from my perspective|in my experience)\b/i, bonus: 0.04 },
    { pattern: /\b(however|on the other hand|that said|although)\b/i, bonus: 0.04 },
    { pattern: /\b(source|according to|research shows|data suggests|studies show)\b/i, bonus: 0.05 },
    { pattern: /\b(what if we|we could|a possible approach|one solution)\b/i, bonus: 0.05 },
    { pattern: /\b(I understand|I appreciate|fair point|good point|you raise)\b/i, bonus: 0.05 },
    { pattern: /\b(nuance|complex|trade-?off|both sides have)\b/i, bonus: 0.04 },
    { pattern: /\b(evidence|peer-?reviewed|published|verified)\b/i, bonus: 0.04 },
    { pattern: /\b(propose|suggest|recommend|advocate for)\b/i, bonus: 0.04 },
    { pattern: /\b(bipartisan|compromise|common ground|middle ground)\b/i, bonus: 0.05 },
    { pattern: /\b(accountability|transparency|oversight)\b/i, bonus: 0.03 },
  ];

  // Only apply bonuses if no severe violation
  if (worstSeverity === 'none' || worstSeverity === 'low') {
    for (const { pattern, bonus } of constructivePatterns) {
      if (pattern.test(text)) score += bonus;
    }

    // Argument structure bonus
    const hasEvidence = /\b(because|since|given that|data shows|evidence)\b/i.test(text);
    const hasReasoning = /\b(therefore|this means|which leads to|as a result|consequently)\b/i.test(text);
    const hasConclusion = /\b(I (believe|argue|conclude)|this suggests|we should)\b/i.test(text);
    if (hasEvidence && hasReasoning) score += 0.05;
    if (hasEvidence && hasConclusion) score += 0.03;
    if (hasEvidence && hasReasoning && hasConclusion) score += 0.05;
  }

  // Final clamp — re-enforce ceiling after bonuses
  const ceiling = worstSeverity === 'critical' ? SEVERITY_CEILINGS.critical
    : worstSeverity === 'high' ? SEVERITY_CEILINGS.high
    : 1.0;

  const finalScore = Math.max(0, Math.min(ceiling, score));

  return { score: finalScore, issues, severity: worstSeverity, category: worstCategory };
}
