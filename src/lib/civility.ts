// ═══════════════════════════════════════════════════════════════
// Civic Social — Civility Analyzer (shared, server + client safe)
// ═══════════════════════════════════════════════════════════════
// Pure function — no React, no browser APIs. Can be imported in
// both API routes (server-side scoring) and client components.
//
// In production: replace with a fine-tuned LLM classifier.
// This heuristic covers: hostility, passive aggression, sarcasm,
// conspiracy rhetoric, straw-manning, readability, and rewards
// constructive discourse patterns.
// ═══════════════════════════════════════════════════════════════

export interface CivilityResult {
  score: number;   // 0–1, higher is more civil
  issues: string[];
}

export function analyzeCivility(text: string): CivilityResult {
  const issues: string[] = [];
  let score = 1.0;

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── 1. All-caps detection ──────────────────────────────
  const capsRatio = (text.replace(/[^A-Z]/g, '').length) / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
  if (capsRatio > 0.5 && wordCount >= 3) {
    score -= 0.2;
    issues.push('Excessive capitalization can read as shouting');
  }

  // ── 2. Direct hostility & personal attacks ─────────────
  const hostilePatterns = [
    { pattern: /\b(stupid|dumb|idiot|moron|loser|clown|fool)\b/i, msg: 'Consider removing personal insults', penalty: 0.20 },
    { pattern: /\b(shut up|you people|those people|these people)\b/i, msg: '"You/those people" language can feel dismissive and othering', penalty: 0.15 },
    { pattern: /!!!+/g, msg: 'Multiple exclamation marks can seem aggressive', penalty: 0.10 },
    { pattern: /\b(always|never) (wrong|right|lie|lies)\b/i, msg: 'Absolute statements reduce nuance', penalty: 0.10 },
    { pattern: /\b(trash|garbage|worthless|disgusting)\b/i, msg: 'Strongly derogatory language reduces constructive dialogue', penalty: 0.15 },
    { pattern: /\bi\s+hate\b/i, msg: 'Expressing hatred is not constructive — focus on specific policy disagreements', penalty: 0.25 },
    { pattern: /\b(hate|despise|loathe)\s+\w+/i, msg: 'Expressing hatred toward people or groups shuts down dialogue', penalty: 0.20 },
    { pattern: /\b(f\*ck|fuck|fk|stfu|gtfo|bs|bullshit|damn|hell)\b/i, msg: 'Profanity reduces the quality of civic discourse', penalty: 0.15 },
    { pattern: /\b(kill|die|death to|destroy)\b.*\b(them|him|her|it)\b/i, msg: 'Violent language is not permitted', penalty: 0.35 },
    { pattern: /\b(worst|terrible|horrible|awful)\s+(president|person|human|leader|politician)\b/i, msg: 'Personal attacks on character are less constructive than policy critique', penalty: 0.12 },
  ];

  for (const { pattern, msg, penalty } of hostilePatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 3. Passive aggression & condescension ──────────────
  const passiveAggressivePatterns = [
    { pattern: /\b(obviously|clearly|anyone with a brain|common sense)\b/i, msg: '"Obviously/clearly" can feel condescending — explain your reasoning instead', penalty: 0.08 },
    { pattern: /\b(I'm not surprised|typical|what did you expect)\b/i, msg: 'This can come across as dismissive — consider engaging with the substance', penalty: 0.08 },
    { pattern: /\b(do your (own )?research|educate yourself|look it up)\b/i, msg: '"Do your research" is dismissive — share specific sources instead', penalty: 0.12 },
    { pattern: /\b(must be nice|good luck with that|sure,? buddy)\b/i, msg: 'Sarcasm can undermine good-faith discussion', penalty: 0.08 },
    { pattern: /\b(imagine (being|thinking|believing))\b/i, msg: '"Imagine thinking..." is often used to mock — consider a direct response', penalty: 0.10 },
    { pattern: /\blol\b.*\b(imagine|literally|can't even)\b/i, msg: "Mockery doesn't contribute to constructive discourse", penalty: 0.08 },
  ];

  for (const { pattern, msg, penalty } of passiveAggressivePatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 4. Conspiracy rhetoric & dog-whistling ─────────────
  const conspiracyPatterns = [
    { pattern: /\b(wake up|sheep|sheeple|open your eyes)\b/i, msg: 'This phrasing is associated with conspiracy rhetoric', penalty: 0.15 },
    { pattern: /\b(they don't want you to know|mainstream media lies|msm)\b/i, msg: 'Blanket media distrust claims need specific evidence', penalty: 0.12 },
    { pattern: /\b(deep state|cabal|plandemic|hoax)\b/i, msg: 'Conspiracy-associated language reduces credibility', penalty: 0.15 },
    { pattern: /\b(both sides are the same|it's all rigged|voting doesn't matter)\b/i, msg: 'Nihilistic framing discourages civic participation', penalty: 0.10 },
    { pattern: /\b(globalist|elites? control|shadow government)\b/i, msg: 'This language is often associated with conspiracy narratives', penalty: 0.12 },
  ];

  for (const { pattern, msg, penalty } of conspiracyPatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 5. Racism, hate speech & discriminatory language ────
  // SEVERE penalties — these should tank the score hard
  const racismPatterns = [
    // Racial slurs (partial list — covers common slurs, not exhaustive)
    { pattern: /\b(n[i1]gg[ae3]r?s?|n[i1]gg[ae3]h?|sp[i1]c[ks]?|ch[i1]nk[s]?|w[e3]tb[a4]ck[s]?|k[i1]k[e3][s]?|g[o0]{2}k[s]?|r[a4]gh[e3][a4]d[s]?|c[o0]{2}n[s]?|b[e3][a4]n[e3]r[s]?)\b/i, msg: 'Racial slurs are strictly prohibited', penalty: 0.50 },
    // Supremacist language
    { pattern: /\b(white\s*power|white\s*supremac|master\s*race|racial?\s*purity|white\s*nationalist|ethno\s*state|race\s*war)\b/i, msg: 'White supremacist and racial supremacy language is prohibited', penalty: 0.45 },
    // Dehumanization based on race/ethnicity
    { pattern: /\b(sub\s*human|animals?|savages?|cockroach|vermin|infestation|invasion)\b.*\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?)\b/i, msg: 'Dehumanizing language toward racial or ethnic groups is prohibited', penalty: 0.45 },
    { pattern: /\b(people|immigrants?|mexicans?|blacks?|whites?|asians?|muslims?|jews?|arabs?)\b.*\b(sub\s*human|animals?|savages?|cockroach|vermin|infestation|invasion)\b/i, msg: 'Dehumanizing language toward racial or ethnic groups is prohibited', penalty: 0.45 },
    // Stereotyping and racist tropes
    { pattern: /\b(go\s*back\s*to\s*(your|their)\s*(country|where))\b/i, msg: '"Go back to your country" is xenophobic and discriminatory', penalty: 0.35 },
    { pattern: /\b(those\s+people\s+are\s+(all|always|never|just))\b/i, msg: 'Blanket negative generalizations about groups are discriminatory', penalty: 0.25 },
    { pattern: /\b(illegal\s*alien[s]?)\b/i, msg: '"Illegal alien" is dehumanizing — use "undocumented immigrant" instead', penalty: 0.15 },
    // Anti-semitic tropes
    { pattern: /\b(jew[s]?\s*(control|run|own)|zionist?\s*occupation|protocols?\s*of\s*zion|jewish\s*(conspiracy|agenda|lobby))\b/i, msg: 'Anti-semitic tropes and conspiracy theories are prohibited', penalty: 0.40 },
    // Islamophobic rhetoric
    { pattern: /\b(all\s*muslims?\s*(are|should)|ban\s*islam|muslim\s*ban|islamic?\s*invasion|creeping\s*sharia)\b/i, msg: 'Islamophobic generalizations are discriminatory', penalty: 0.35 },
    // Homophobic/transphobic slurs
    { pattern: /\b(f[a4]g[gs]?[o0]?t[s]?|tr[a4]nn[yi1][e3]?[s]?|d[yi1]k[e3][s]?)\b/i, msg: 'Homophobic and transphobic slurs are strictly prohibited', penalty: 0.45 },
    // General racial/ethnic hatred
    { pattern: /\b(hate|kill|deport|exterminate|eradicate)\s+(all\s+)?(blacks?|whites?|asians?|mexicans?|jews?|muslims?|immigrants?|foreigners?|latinos?|hispanics?|arabs?)\b/i, msg: 'Advocating hatred or violence against racial/ethnic groups is strictly prohibited', penalty: 0.50 },
  ];

  for (const { pattern, msg, penalty } of racismPatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 6. Straw-manning & bad-faith framing ──────────────
  const strawmanPatterns = [
    { pattern: /\b(so you're saying|you basically want|you think that)\b.*\b(kill|destroy|hate|ruin)\b/i, msg: "Avoid putting extreme words in others' mouths (straw-manning)", penalty: 0.12 },
    { pattern: /\b(all (liberals|conservatives|republicans|democrats) (want|think|believe|are))\b/i, msg: 'Broad generalizations about political groups reduce nuance', penalty: 0.10 },
    { pattern: /\b(the (left|right) always)\b/i, msg: 'Attributing behavior to an entire side oversimplifies complex issues', penalty: 0.08 },
  ];

  for (const { pattern, msg, penalty } of strawmanPatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 6. Low-effort inflammatory content ─────────────────
  // Short posts with negative sentiment and no substance get penalized
  if (wordCount <= 8) {
    const hasNegative = /\b(hate|suck|worst|terrible|horrible|awful|stupid|dumb|trash|garbage|evil|corrupt)\b/i.test(lower);
    const hasConstructive = /\b(because|however|although|policy|issue|think|believe|suggest|source)\b/i.test(lower);
    if (hasNegative && !hasConstructive) {
      score -= 0.15;
      issues.push('Short inflammatory posts lack substance — add reasoning or evidence');
    }
  }

  // ── 8. Readability check ───────────────────────────────
  if (wordCount > 30) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
    if (avgSentenceLength > 40) {
      score -= 0.05;
      issues.push('Very long sentences can be hard to follow — consider breaking them up');
    }
  }

  // ── 9. Excessive hashtag stuffing ──────────────────────
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) {
    score -= 0.08;
    issues.push('Excessive hashtags can look like spam — focus on your message');
  }

  // ── 10. Constructive discourse bonuses ─────────────────
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

  for (const { pattern, bonus } of constructivePatterns) {
    if (pattern.test(text)) score += bonus;
  }

  // ── 11. Argument structure bonus ───────────────────────
  const hasEvidence = /\b(because|since|given that|data shows|evidence)\b/i.test(text);
  const hasReasoning = /\b(therefore|this means|which leads to|as a result|consequently)\b/i.test(text);
  const hasConclusion = /\b(I (believe|argue|conclude)|this suggests|we should)\b/i.test(text);
  if (hasEvidence && hasReasoning) score += 0.05;
  if (hasEvidence && hasConclusion) score += 0.03;
  if (hasEvidence && hasReasoning && hasConclusion) score += 0.05;

  return { score: Math.max(0, Math.min(1, score)), issues };
}
