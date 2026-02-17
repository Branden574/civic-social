'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Link2,
  Hash,
  Send,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Globe,
  MessageCircle,
  Users,
  Lock,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import { usePostStore } from '@/lib/post-store';
import { useAuth } from '@/lib/auth-context';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

const SUGGESTED_TOPICS = [
  'healthcare', 'economy', 'climate', 'education', 'immigration',
  'criminal-justice', 'technology', 'defense', 'infrastructure',
  'housing', 'elections', 'foreign-policy', 'civil-rights', 'taxation',
];

// ── Enhanced Civility Analyzer (v2) ──────────────────────────
// In production, this would be a fine-tuned LLM or classifier.
// This heuristic covers: hostility, passive aggression, sarcasm,
// dog-whistling, conspiracy rhetoric, readability, and rewards
// constructive discourse patterns.

function analyzeCivility(text: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1.0;

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // ── 1. All-caps detection ──────────────────────────────
  const capsRatio = (text.replace(/[^A-Z]/g, '').length) / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
  if (capsRatio > 0.5 && text.length > 20) {
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
    { pattern: /\b(hate|despise|loathe) (them|you|liberals|conservatives|democrats|republicans)\b/i, msg: 'Expressing hatred toward groups shuts down dialogue', penalty: 0.20 },
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
    { pattern: /\blol\b.*\b(imagine|literally|can't even)\b/i, msg: 'Mockery doesn\'t contribute to constructive discourse', penalty: 0.08 },
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

  // ── 5. Straw-manning & bad-faith framing ───────────────
  const strawmanPatterns = [
    { pattern: /\b(so you're saying|you basically want|you think that)\b.*\b(kill|destroy|hate|ruin)\b/i, msg: 'Avoid putting extreme words in others\' mouths (straw-manning)', penalty: 0.12 },
    { pattern: /\b(all (liberals|conservatives|republicans|democrats) (want|think|believe|are))\b/i, msg: 'Broad generalizations about political groups reduce nuance', penalty: 0.10 },
    { pattern: /\b(the (left|right) always)\b/i, msg: 'Attributing behavior to an entire side oversimplifies complex issues', penalty: 0.08 },
  ];

  for (const { pattern, msg, penalty } of strawmanPatterns) {
    if (pattern.test(lower)) {
      score -= penalty;
      issues.push(msg);
    }
  }

  // ── 6. Readability check ───────────────────────────────
  // Extremely long sentences with no breaks are hard to engage with
  if (wordCount > 30) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
    if (avgSentenceLength > 40) {
      score -= 0.05;
      issues.push('Very long sentences can be hard to follow — consider breaking them up');
    }
  }

  // ── 7. Excessive hashtag stuffing ──────────────────────
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) {
    score -= 0.08;
    issues.push('Excessive hashtags can look like spam — focus on your message');
  }

  // ── 8. Constructive discourse bonuses ──────────────────
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

  // ── 9. Argument structure bonus ────────────────────────
  // Posts that present evidence → reasoning → conclusion pattern
  const hasEvidence = /\b(because|since|given that|data shows|evidence)\b/i.test(text);
  const hasReasoning = /\b(therefore|this means|which leads to|as a result|consequently)\b/i.test(text);
  const hasConclusion = /\b(I (believe|argue|conclude)|this suggests|we should)\b/i.test(text);
  if (hasEvidence && hasReasoning) score += 0.05;
  if (hasEvidence && hasConclusion) score += 0.03;
  if (hasEvidence && hasReasoning && hasConclusion) score += 0.05;

  return { score: Math.max(0, Math.min(1, score)), issues };
}

export function ComposeModal({ isOpen, onClose, onPostCreated }: ComposeModalProps) {
  const { addPost, confirmPost, markPostFailed } = usePostStore();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [showTopics, setShowTopics] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [civility, setCivility] = useState<{ score: number; issues: string[] }>({ score: 1, issues: [] });
  const [showCivilityCheck, setShowCivilityCheck] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentPolicy, setCommentPolicy] = useState<'everyone' | 'followers_only' | 'off'>('everyone');
  const [showReplyMenu, setShowReplyMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Run civility check as user types (debounced)
  useEffect(() => {
    if (content.length < 10) {
      setCivility({ score: 1, issues: [] });
      return;
    }
    const timer = setTimeout(() => {
      const result = analyzeCivility(content);
      setCivility(result);
      if (result.issues.length > 0) setShowCivilityCheck(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [content]);

  const toggleTopic = useCallback((topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  }, []);

  const addHashtag = useCallback(() => {
    const tag = hashtagInput.replace(/^#/, '').trim().toLowerCase();
    if (tag && !customHashtags.includes(tag) && !selectedTopics.includes(tag)) {
      setCustomHashtags((prev) => [...prev, tag]);
      setHashtagInput('');
    }
  }, [hashtagInput, customHashtags, selectedTopics]);

  const removeHashtag = useCallback((tag: string) => {
    setCustomHashtags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handlePost = useCallback(async () => {
    if (!content.trim()) return;
    setPosting(true);

    const allTopics = [...selectedTopics, ...customHashtags];

    // ─── Optimistic UI: insert post immediately ──────────
    const newPost = addPost({
      content: content.trim(),
      topics: allTopics,
      articleUrl: articleUrl || undefined,
      civilityScore: civility.score,
    });

    // Reset form and close immediately (post already visible)
    setContent('');
    setArticleUrl('');
    setSelectedTopics([]);
    setCustomHashtags([]);
    setShowCivilityCheck(false);
    setCommentPolicy('everyone');
    setPosting(false);
    onClose();

    // Notify parent to refresh feed
    onPostCreated?.();

    // ─── Server persistence ─────────────────────────────
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          topics: allTopics,
          articleUrl: articleUrl || undefined,
          civilityScore: civility.score,
          comment_policy: commentPolicy,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      // Mark post as confirmed with server-assigned data
      confirmPost(newPost.id, data.post);
    } catch {
      // Server failed — mark as failed for rollback UI
      markPostFailed(newPost.id);
    }
  }, [content, selectedTopics, customHashtags, articleUrl, civility.score, addPost, confirmPost, markPostFailed, onClose, onPostCreated]);

  const allTags = [...selectedTopics, ...customHashtags];
  const charCount = content.length;
  const maxChars = 2000;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-xl bg-bg-alt sm:rounded-2xl border border-border-subtle max-h-[90vh] overflow-hidden flex flex-col animate-slide-up rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-text-primary">New Post</span>
          <button
            onClick={handlePost}
            disabled={!content.trim() || posting}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
              content.trim() && !posting
                ? 'bg-civic text-white hover:bg-civic-dark'
                : 'bg-surface-active text-text-muted cursor-not-allowed',
            )}
          >
            {posting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Post
              </>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* User indicator */}
          <div className="flex items-start gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-civic/20 flex items-center justify-center text-civic-light text-sm font-semibold shrink-0">
              {user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{user?.displayName || 'Anonymous'}</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReplyMenu(!showReplyMenu)}
                  className="flex items-center gap-1 text-[11px] text-text-muted hover:text-civic-light transition-colors"
                >
                  {commentPolicy === 'everyone' && <><MessageCircle className="w-3 h-3" /> Everyone can reply</>}
                  {commentPolicy === 'followers_only' && <><Users className="w-3 h-3" /> Followers only</>}
                  {commentPolicy === 'off' && <><Lock className="w-3 h-3" /> Replies off</>}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showReplyMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-bg-alt border border-border-subtle rounded-lg shadow-lg z-50 py-1 animate-fade-in">
                    {[
                      { value: 'everyone' as const, icon: MessageCircle, label: 'Everyone', desc: 'Anyone can reply' },
                      { value: 'followers_only' as const, icon: Users, label: 'Followers', desc: 'Only followers can reply' },
                      { value: 'off' as const, icon: Lock, label: 'No one', desc: 'Replies turned off' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setCommentPolicy(opt.value); setShowReplyMenu(false); }}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors',
                          commentPolicy === opt.value && 'bg-civic/5',
                        )}
                      >
                        <opt.icon className={clsx('w-4 h-4', commentPolicy === opt.value ? 'text-civic-light' : 'text-text-muted')} />
                        <div>
                          <p className={clsx('text-xs font-medium', commentPolicy === opt.value ? 'text-civic-light' : 'text-text-primary')}>{opt.label}</p>
                          <p className="text-[10px] text-text-muted">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your perspective... What policy matters to you? Link an article. Start a discussion."
            className="w-full mt-3 bg-transparent text-text-primary text-[15px] leading-relaxed placeholder:text-text-muted resize-none focus:outline-none min-h-[120px]"
            maxLength={maxChars}
            autoFocus
          />

          {/* Article URL input */}
          {showUrlInput && (
            <div className="mt-3 animate-fade-in">
              <div className="flex items-center gap-2 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
                <Globe className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="Paste article URL..."
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                {articleUrl && (
                  <button
                    onClick={() => { setArticleUrl(''); setShowUrlInput(false); }}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {articleUrl && (
                <div className="mt-2 p-3 bg-surface rounded-lg border border-border-subtle">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                    Article Preview
                  </p>
                  <p className="text-sm text-civic-light truncate">{articleUrl}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Article will be fact-checked and scored for credibility
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Hashtag input */}
          {showTopics && (
            <div className="mt-3 animate-fade-in">
              {/* Custom hashtag input */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1 p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                  <Hash className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value.replace(/\s/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addHashtag(); }
                    }}
                    placeholder="Add custom hashtag..."
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                </div>
                <button
                  onClick={addHashtag}
                  disabled={!hashtagInput.trim()}
                  className="px-3 py-2 bg-civic/10 text-civic-light text-xs font-semibold rounded-lg hover:bg-civic/20 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>

              {/* Suggested topics */}
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Suggested Topics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={clsx(
                      'text-[11px] font-medium px-2 py-1 rounded-full transition-all',
                      selectedTopics.includes(topic)
                        ? 'bg-civic text-white'
                        : 'bg-surface-active text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    #{topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected tags display */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {allTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 text-[11px] font-medium text-civic-light bg-civic/10 px-2 py-0.5 rounded-full"
                >
                  #{tag}
                  <button
                    onClick={() => {
                      if (selectedTopics.includes(tag)) toggleTopic(tag);
                      else removeHashtag(tag);
                    }}
                    className="hover:text-danger-light"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* AI Civility Pre-Check */}
          {showCivilityCheck && content.length > 10 && (
            <div className="mt-4 animate-fade-in">
              <div
                className={clsx(
                  'p-3 rounded-lg border',
                  civility.score >= 0.8
                    ? 'bg-positive/5 border-positive/20'
                    : civility.score >= 0.5
                      ? 'bg-warning/5 border-warning/20'
                      : 'bg-danger/5 border-danger/20',
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {civility.score >= 0.8 ? (
                    <CheckCircle2 className="w-4 h-4 text-positive-light" />
                  ) : civility.score >= 0.5 ? (
                    <Shield className="w-4 h-4 text-warning-light" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-danger-light" />
                  )}
                  <span className="text-xs font-semibold text-text-primary">
                    Civility Check: {Math.round(civility.score * 100)}%
                  </span>
                  <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden ml-2">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        civility.score >= 0.8
                          ? 'bg-positive'
                          : civility.score >= 0.5
                            ? 'bg-warning'
                            : 'bg-danger',
                      )}
                      style={{ width: `${Math.round(civility.score * 100)}%` }}
                    />
                  </div>
                </div>
                {civility.issues.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {civility.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                        <span className="text-warning-light mt-0.5">•</span>
                        {issue}
                      </p>
                    ))}
                    <p className="text-[11px] text-text-muted mt-1 italic">
                      Would you like to rephrase for clarity and civility?
                    </p>
                  </div>
                )}
                {civility.issues.length === 0 && civility.score >= 0.8 && (
                  <p className="text-xs text-positive-light">
                    Great tone! This post promotes constructive discourse.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showUrlInput ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Attach article"
            >
              <Link2 className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => setShowTopics(!showTopics)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                showTopics ? 'text-civic-light bg-civic/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
              title="Add hashtags"
            >
              <Hash className="w-4.5 h-4.5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Character count */}
            <span
              className={clsx(
                'text-xs font-mono',
                charCount > maxChars * 0.9
                  ? 'text-danger-light'
                  : charCount > maxChars * 0.7
                    ? 'text-warning-light'
                    : 'text-text-muted',
              )}
            >
              {charCount}/{maxChars}
            </span>
            {/* Civility indicator */}
            {content.length > 10 && (
              <button
                onClick={() => setShowCivilityCheck(!showCivilityCheck)}
                className={clsx(
                  'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors',
                  civility.score >= 0.8
                    ? 'bg-positive/10 text-positive-light'
                    : civility.score >= 0.5
                      ? 'bg-warning/10 text-warning-light'
                      : 'bg-danger/10 text-danger-light',
                )}
              >
                <Shield className="w-3 h-3" />
                {Math.round(civility.score * 100)}%
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
