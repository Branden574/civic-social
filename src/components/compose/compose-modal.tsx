'use client';

import { useReducer, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  X,
  Link2,
  Hash,
  Loader2,
  Globe,
  Users,
  Lock,
  ChevronDown,
  AtSign,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { usePostStore } from '@/lib/post-store';
import { useAuth } from '@/lib/auth-context';
import { moderateLocal } from '@/lib/moderation/analyzer';
import type { ModerationResult } from '@/lib/moderation/types';
import {
  ToneIndicator,
  CoachPanel,
  BlockedPanel,
  HeldConfirmation,
  NudgeConfirmation,
  toneFromResult,
  type ToneLevel,
} from './moderation-feedback';

// ─── Props ────────────────────────────────────────────────────

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  initialArticleUrl?: string;
  initialContent?: string;
}

// ─── Constants ────────────────────────────────────────────────
// Six post types with prototype ideology/role colors.

const POST_TYPE_OPTIONS = [
  { value: 'OPEN_DISCUSSION', label: 'Discussion', icon: '💬', color: 'text-civic-light', activeBg: 'bg-civic-muted', activeBorder: 'border-civic' },
  { value: 'POLICY_PROPOSAL', label: 'Policy Proposal', icon: '📋', color: 'text-civic-light', activeBg: 'bg-civic-muted', activeBorder: 'border-civic' },
  { value: 'NEWS_DISCUSSION', label: 'News Discussion', icon: '📰', color: 'text-positive-light', activeBg: 'bg-positive/10', activeBorder: 'border-positive' },
  { value: 'STRUCTURED_DEBATE', label: 'Debate', icon: '⚖️', color: 'text-info-light', activeBg: 'bg-info/10', activeBorder: 'border-info' },
  { value: 'CROSS_PARTY_ROUNDTABLE', label: 'Cross-Party', icon: '🤝', color: 'text-ideology-center-left', activeBg: 'bg-ideology-center-left/10', activeBorder: 'border-ideology-center-left' },
  { value: 'EXPERT_AMA', label: 'Expert Q&A', icon: '🎓', color: 'text-ideology-center', activeBg: 'bg-ideology-center/10', activeBorder: 'border-ideology-center' },
] as const;

const SUGGESTED_TOPICS = [
  'healthcare', 'economy', 'climate', 'education', 'immigration',
  'criminal-justice', 'technology', 'defense', 'infrastructure',
  'housing', 'elections', 'foreign-policy', 'civil-rights', 'taxation',
];

// Server enforces 2000 (verified in src/app/api/posts/route.ts).
const MAX_CHARS = 2000;

// ─── Server moderation response shapes (POST /api/posts contract) ─

interface BlockResponse {
  action: 'block';
  message: string | null;
  issues: string[];
  suggestions: string[];
}

type ServerOutcome =
  | { kind: 'blocked'; block: BlockResponse }
  | { kind: 'held'; message: string | null }
  | { kind: 'nudged'; message: string | null }
  | null;

// ─── Reducer ──────────────────────────────────────────────────

interface ComposeState {
  content: string;
  articleUrl: string;
  showUrlInput: boolean;
  selectedTopics: string[];
  showTopics: boolean;
  hashtagInput: string;
  customHashtags: string[];
  posting: boolean;
  commentPolicy: 'everyone' | 'followers_only' | 'off';
  postType: string;
  showTypeMenu: boolean;
  showReplyMenu: boolean;
  submitError: string | null;
  closing: boolean;
  outcome: ServerOutcome;
}

type ComposeAction =
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_ARTICLE_URL'; payload: string }
  | { type: 'TOGGLE_URL_INPUT' }
  | { type: 'CLEAR_URL' }
  | { type: 'TOGGLE_TOPIC'; payload: string }
  | { type: 'TOGGLE_TOPICS' }
  | { type: 'SET_HASHTAG_INPUT'; payload: string }
  | { type: 'ADD_HASHTAG'; payload: string }
  | { type: 'REMOVE_HASHTAG'; payload: string }
  | { type: 'SET_POSTING'; payload: boolean }
  | { type: 'SET_COMMENT_POLICY'; payload: 'everyone' | 'followers_only' | 'off' }
  | { type: 'SET_POST_TYPE'; payload: string }
  | { type: 'TOGGLE_TYPE_MENU' }
  | { type: 'TOGGLE_REPLY_MENU' }
  | { type: 'CLOSE_MENUS' }
  | { type: 'SET_SUBMIT_ERROR'; payload: string | null }
  | { type: 'SET_CLOSING'; payload: boolean }
  | { type: 'SET_OUTCOME'; payload: ServerOutcome }
  | { type: 'SEED'; payload: { articleUrl?: string; content?: string } }
  | { type: 'RESET' };

const initialState: ComposeState = {
  content: '',
  articleUrl: '',
  showUrlInput: false,
  selectedTopics: [],
  showTopics: false,
  hashtagInput: '',
  customHashtags: [],
  posting: false,
  commentPolicy: 'everyone',
  postType: 'OPEN_DISCUSSION',
  showTypeMenu: false,
  showReplyMenu: false,
  submitError: null,
  closing: false,
  outcome: null,
};

function composeReducer(state: ComposeState, action: ComposeAction): ComposeState {
  switch (action.type) {
    case 'SET_CONTENT':
      // Any edit clears a prior blocked outcome so submit can re-enable.
      return {
        ...state,
        content: action.payload,
        outcome: state.outcome?.kind === 'blocked' ? null : state.outcome,
      };
    case 'SET_ARTICLE_URL':
      return { ...state, articleUrl: action.payload };
    case 'TOGGLE_URL_INPUT':
      return { ...state, showUrlInput: !state.showUrlInput };
    case 'CLEAR_URL':
      return { ...state, articleUrl: '', showUrlInput: false };
    case 'TOGGLE_TOPIC': {
      const topics = state.selectedTopics.includes(action.payload)
        ? state.selectedTopics.filter((t) => t !== action.payload)
        : [...state.selectedTopics, action.payload];
      return { ...state, selectedTopics: topics };
    }
    case 'TOGGLE_TOPICS':
      return { ...state, showTopics: !state.showTopics };
    case 'SET_HASHTAG_INPUT':
      return { ...state, hashtagInput: action.payload };
    case 'ADD_HASHTAG': {
      const tag = action.payload.replace(/^#/, '').trim().toLowerCase();
      if (!tag || state.customHashtags.includes(tag) || state.selectedTopics.includes(tag)) return state;
      return { ...state, customHashtags: [...state.customHashtags, tag], hashtagInput: '' };
    }
    case 'REMOVE_HASHTAG':
      return { ...state, customHashtags: state.customHashtags.filter((t) => t !== action.payload) };
    case 'SET_POSTING':
      return { ...state, posting: action.payload };
    case 'SET_COMMENT_POLICY':
      return { ...state, commentPolicy: action.payload, showReplyMenu: false };
    case 'SET_POST_TYPE':
      return { ...state, postType: action.payload, showTypeMenu: false };
    case 'TOGGLE_TYPE_MENU':
      return { ...state, showTypeMenu: !state.showTypeMenu, showReplyMenu: false };
    case 'TOGGLE_REPLY_MENU':
      return { ...state, showReplyMenu: !state.showReplyMenu, showTypeMenu: false };
    case 'CLOSE_MENUS':
      return { ...state, showTypeMenu: false, showReplyMenu: false };
    case 'SET_SUBMIT_ERROR':
      return { ...state, submitError: action.payload };
    case 'SET_CLOSING':
      return { ...state, closing: action.payload };
    case 'SET_OUTCOME':
      return { ...state, outcome: action.payload };
    case 'SEED': {
      const next = { ...state };
      if (action.payload.articleUrl) { next.articleUrl = action.payload.articleUrl; next.showUrlInput = true; }
      if (action.payload.content) { next.content = action.payload.content; }
      return next;
    }
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// Empty result placeholder so the coach hooks have a stable value.
const EMPTY_MODERATION = moderateLocal('');

// ─── Component ────────────────────────────────────────────────

export function ComposeModal({ isOpen, onClose, onPostCreated, initialArticleUrl, initialContent }: ComposeModalProps) {
  const { addPost, confirmPost, removePost } = usePostStore();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(composeReducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // @mention state (kept as useState — tightly coupled to async search)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; displayName: string; username: string; avatarUrl?: string }[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);

  // ── Civility coach: debounced local moderation ─────────────
  // moderateLocal is the same engine the server uses as its floor.
  // We debounce the *input* to the analysis (300ms) and memoize the
  // verdict on the debounced text so the coach is live but cheap.
  const [debouncedContent, setDebouncedContent] = useState('');

  const {
    content, articleUrl, showUrlInput, selectedTopics, showTopics,
    hashtagInput, customHashtags,
    posting, commentPolicy, postType, showTypeMenu, showReplyMenu,
    submitError, closing, outcome,
  } = state;

  // ── Seed initial values when modal opens ──────────────────
  useEffect(() => {
    if (isOpen) {
      if (initialArticleUrl || initialContent) {
        dispatch({ type: 'SEED', payload: { articleUrl: initialArticleUrl, content: initialContent } });
      }
    }
  }, [isOpen, initialArticleUrl, initialContent]);

  // ── Auto-resize textarea ──────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // ── Debounce content → analysis input (300ms) ─────────────
  useEffect(() => {
    if (!content.trim()) {
      setDebouncedContent('');
      return;
    }
    const timer = setTimeout(() => setDebouncedContent(content), 300);
    return () => clearTimeout(timer);
  }, [content]);

  // ── Live moderation verdict (memoized on debounced content) ─
  const moderation: ModerationResult = useMemo(
    () => (debouncedContent.trim() ? moderateLocal(debouncedContent) : EMPTY_MODERATION),
    [debouncedContent],
  );

  const isEmpty = !content.trim();
  const tone: ToneLevel = useMemo(() => toneFromResult(moderation, isEmpty), [moderation, isEmpty]);

  // Coaching suggestions (max 3). Adds an evidence nudge when the post
  // is substantial (>15 words) but carries no evidence orientation.
  const coachSuggestions = useMemo(() => {
    if (isEmpty) return [];
    const out = [...moderation.suggestions];
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (
      moderation.signals.evidenceOrientation === 0 &&
      wordCount > 15 &&
      !out.some((s) => /source|evidence/i.test(s))
    ) {
      out.unshift('Add a source — sourced posts rank higher.');
    }
    return [...new Set(out)].slice(0, 3);
  }, [moderation, content, isEmpty]);

  // ── @mention detection ────────────────────────────────────
  const handleContentChange = useCallback((value: string) => {
    dispatch({ type: 'SET_CONTENT', payload: value });
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/(?:^|[\s,.()!?])@([a-zA-Z0-9._-]{0,30})$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, []);

  // ── @mention search ───────────────────────────────────────
  useEffect(() => {
    if (mentionQuery === null) { setMentionResults([]); return; }
    const controller = new AbortController();
    const delay = mentionQuery.length === 0 ? 50 : 120;
    const timer = setTimeout(async () => {
      setMentionLoading(true);
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(mentionQuery)}&limit=6&scope=global`, { signal: controller.signal });
        if (res.ok) { const data = await res.json(); setMentionResults(data.users || []); }
      } catch { /* aborted or failed */ } finally { setMentionLoading(false); }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mentionQuery]);

  // ── Insert @mention ───────────────────────────────────────
  const insertMention = useCallback((username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const mentionMatch = textBefore.match(/(?:^|[\s,.()!?])@([a-zA-Z0-9._-]{0,30})$/);
    if (!mentionMatch) return;
    const atPos = textBefore.lastIndexOf('@' + mentionMatch[1]);
    const newText = textBefore.slice(0, atPos) + '@' + username + ' ' + textAfter;
    dispatch({ type: 'SET_CONTENT', payload: newText });
    setMentionQuery(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      const newCursor = atPos + username.length + 2;
      textarea.setSelectionRange(newCursor, newCursor);
      textarea.focus();
    });
  }, [content]);

  // Derived posting guards used by submit + keyboard.
  const overLimit = content.length > MAX_CHARS;
  const isBlocked = outcome?.kind === 'blocked';
  const canPost = !!content.trim() && !posting && !overLimit && !isBlocked;

  // ── Close with animation ──────────────────────────────────
  const finalizeClose = useCallback(() => {
    dispatch({ type: 'SET_CLOSING', payload: false });
    dispatch({ type: 'RESET' });
    setMentionQuery(null);
    setMentionResults([]);
    setDebouncedContent('');
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_CLOSING', payload: true });
    setTimeout(finalizeClose, 250);
  }, [finalizeClose]);

  // ── Dialog a11y: scroll lock, focus restore, Escape, focus trap ──
  // Keep a ref to the latest close handler so the effect can stay keyed
  // on `isOpen` alone (no re-binding of listeners every render).
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  // Mirror mention-open state so Escape closes the autocomplete first,
  // the dialog second, without re-running the effect.
  const mentionOpenRef = useRef(false);
  mentionOpenRef.current = mentionQuery !== null;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let the mention autocomplete consume Escape first.
        if (mentionOpenRef.current) return;
        e.preventDefault();
        handleCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // Focus trap: cycle Tab within the dialog.
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger when the dialog fully unmounts.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  const closeAfterSuccess = useCallback(() => {
    dispatch({ type: 'SET_CLOSING', payload: true });
    setTimeout(finalizeClose, 250);
  }, [finalizeClose]);

  // ── Submit post ───────────────────────────────────────────
  const handlePost = useCallback(async () => {
    if (!content.trim() || posting || overLimit || outcome?.kind === 'blocked') return;
    dispatch({ type: 'SET_POSTING', payload: true });
    dispatch({ type: 'SET_SUBMIT_ERROR', payload: null });

    const allTopics = [...selectedTopics, ...customHashtags];
    const safeArticleUrl = articleUrl || undefined;

    // Optimistic post — but only commit it to the visible feed for
    // allow/nudge outcomes. Held/blocked posts must NOT appear, so we
    // add optimistically then REMOVE on held/block before confirming.
    let newPost: ReturnType<typeof addPost> | null = null;

    try {
      newPost = addPost({
        content: content.trim(),
        topics: allTopics,
        articleUrl: safeArticleUrl,
        civilityScore: moderation.score,
      });

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          topics: allTopics,
          articleUrl: safeArticleUrl,
          comment_policy: commentPolicy,
          postType,
        }),
      });

      // ── 422 BLOCK: server refused to publish ───────────────
      if (res.status === 422) {
        const body = await res.json().catch(() => ({}));
        const mod = body?.moderation;
        // Roll back the optimistic post — it must not appear in the feed.
        if (newPost) removePost(newPost.id);
        dispatch({
          type: 'SET_OUTCOME',
          payload: {
            kind: 'blocked',
            block: {
              action: 'block',
              message: mod?.message ?? body?.error ?? null,
              issues: Array.isArray(mod?.issues) ? mod.issues : [],
              suggestions: Array.isArray(mod?.suggestions) ? mod.suggestions : [],
            },
          },
        });
        dispatch({ type: 'SET_POSTING', payload: false });
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const mod = data?.moderation;
      const held = mod?.action === 'hold_for_review' || mod?.held === true;

      if (held) {
        // Held posts are NOT public yet — roll back the optimistic feed
        // entry and show the confirmation state instead of closing.
        if (newPost) removePost(newPost.id);
        dispatch({ type: 'SET_OUTCOME', payload: { kind: 'held', message: mod?.message ?? null } });
        dispatch({ type: 'SET_POSTING', payload: false });
        // The post is created server-side; tell the parent to refresh
        // so any pending-review surfaces (e.g. profile) stay accurate.
        onPostCreated?.();
        return;
      }

      // ── ALLOW / NUDGE: post proceeds, keep it in the feed ──
      confirmPost(newPost.id, data.post);
      onPostCreated?.();

      if (mod?.action === 'nudge' && mod?.message) {
        // Brief in-modal confirmation banner, then close.
        dispatch({ type: 'SET_OUTCOME', payload: { kind: 'nudged', message: mod.message } });
        dispatch({ type: 'SET_POSTING', payload: false });
        setTimeout(() => closeAfterSuccess(), 1600);
        return;
      }

      closeAfterSuccess();
    } catch (err) {
      if (newPost) removePost(newPost.id);
      const msg = err instanceof Error ? err.message : 'Post failed to publish. Please try again.';
      dispatch({ type: 'SET_SUBMIT_ERROR', payload: msg });
      dispatch({ type: 'SET_POSTING', payload: false });
    }
  }, [content, selectedTopics, customHashtags, articleUrl, moderation.score, commentPolicy, postType, posting, overLimit, outcome, addPost, confirmPost, removePost, onPostCreated, closeAfterSuccess]);

  // ── Keyboard: mention nav + Cmd+Enter ─────────────────────
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionResults.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(prev => Math.min(prev + 1, mentionResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(prev => Math.max(prev - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionResults[mentionIdx].username); return; }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionResults([]); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canPost) {
      e.preventDefault();
      handlePost();
    }
  }, [mentionResults, mentionQuery, mentionIdx, insertMention, canPost, handlePost]);

  // ── Close menus on outside tap ────────────────────────────
  useEffect(() => {
    if (!showTypeMenu && !showReplyMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) dispatch({ type: 'CLOSE_MENUS' });
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [showTypeMenu, showReplyMenu]);

  const allTags = [...selectedTopics, ...customHashtags];
  const charCount = content.length;
  const charsLeft = MAX_CHARS - charCount;
  const activeType = POST_TYPE_OPTIONS.find((t) => t.value === postType) ?? POST_TYPE_OPTIONS[0];

  if (!isOpen && !closing) return null;

  // ── Confirmation states replace the editor body ───────────
  const isHeld = outcome?.kind === 'held';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop (blur) */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          closing ? 'opacity-0' : 'opacity-100',
        )}
        onClick={handleClose}
      />

      {/* Modal container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Compose a post"
        className={clsx(
          'relative w-full sm:max-w-[600px] bg-bg sm:bg-bg-alt overflow-hidden flex flex-col',
          'h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-border shadow-2xl sm:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'sm:pt-0 sm:pb-0',
          closing
            ? 'animate-bottom-sheet-down sm:animate-shared-collapse'
            : 'animate-bottom-sheet-up sm:animate-slide-up',
        )}
      >
        {/* ── Header: close + title + live tone indicator ────── */}
        <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 shrink-0">
          <button
            onClick={handleClose}
            aria-label="Close compose"
            className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
          <span className="text-[15px] font-bold text-text-primary">New Post</span>
          <div className="ml-auto">
            <ToneIndicator tone={tone} />
          </div>
        </div>

        {isHeld ? (
          <HeldConfirmation message={outcome?.kind === 'held' ? outcome.message : null} onDone={handleClose} />
        ) : (
          <>
            {/* ── Post type selector (6 types, prototype colors) ── */}
            <div className="flex gap-1.5 flex-wrap px-4 pb-3">
              {POST_TYPE_OPTIONS.map((opt) => {
                const active = postType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => dispatch({ type: 'SET_POST_TYPE', payload: opt.value })}
                    aria-pressed={active}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-colors min-h-[32px]',
                      active
                        ? clsx(opt.activeBg, opt.color, opt.activeBorder)
                        : 'bg-transparent text-text-muted border-border-subtle hover:text-text-primary',
                    )}
                  >
                    <span aria-hidden>{opt.icon}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* ── Body: avatar + textarea + coach + inputs ─────── */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              <div className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0 pt-0.5">
                  {user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar from arbitrary remote host; matches post-card pattern
                    <img src={user.avatar} alt={user.displayName} className="w-[42px] h-[42px] rounded-full object-cover border border-border-subtle" />
                  ) : (
                    <div className="w-[42px] h-[42px] rounded-full bg-civic-muted flex items-center justify-center text-civic-light text-[13px] font-bold">
                      {user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* Content column */}
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => handleContentChange(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="Share your perspective…"
                      aria-label="Post content"
                      className="w-full bg-transparent text-text-primary text-[17px] leading-[1.55] placeholder:text-text-muted/70 resize-none border-none focus:outline-none focus:ring-0 min-h-[100px] sm:min-h-[120px] pt-1"
                      autoFocus
                    />

                    {/* @mention autocomplete */}
                    {mentionQuery !== null && (mentionResults.length > 0 || mentionLoading) && (
                      <div className="absolute left-0 right-0 mt-1 bg-bg-alt border border-border-subtle rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in max-h-[280px] overflow-y-auto">
                        {mentionLoading && mentionResults.length === 0 && (
                          <div className="px-3 py-3 text-xs text-text-muted">Searching...</div>
                        )}
                        {mentionResults.map((u, i) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insertMention(u.username); }}
                            className={clsx(
                              'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                              i === mentionIdx ? 'bg-civic-subtle' : 'hover:bg-surface-hover',
                            )}
                          >
                            {u.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar from arbitrary remote host; matches post-card pattern
                              <img src={u.avatarUrl} alt={u.displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-border-subtle" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-text-secondary text-xs font-semibold shrink-0 border border-border-subtle">
                                {u.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-primary truncate">{u.displayName}</p>
                              <p className="text-xs text-text-muted truncate">@{u.username}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected tags */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {allTags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 text-xs font-medium text-civic-light bg-civic-subtle px-2 py-0.5 rounded-full">
                          #{tag}
                          <button
                            onClick={() => {
                              if (selectedTopics.includes(tag)) dispatch({ type: 'TOGGLE_TOPIC', payload: tag });
                              else dispatch({ type: 'REMOVE_HASHTAG', payload: tag });
                            }}
                            aria-label={`Remove #${tag}`}
                            className="hover:text-danger-light"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>{/* end content column */}
              </div>{/* end avatar+content row */}

              {/* ── Civility coach panel (full width) ──────────── */}
              {!isBlocked && coachSuggestions.length > 0 && (
                <div className="mt-3">
                  <CoachPanel suggestions={coachSuggestions} />
                </div>
              )}

              {/* ── Server blocked state (422) ─────────────────── */}
              {isBlocked && outcome?.kind === 'blocked' && (
                <div className="mt-3">
                  <BlockedPanel
                    message={outcome.block.message}
                    issues={outcome.block.issues}
                    suggestions={outcome.block.suggestions}
                  />
                </div>
              )}

              {/* ── Nudge banner (post proceeded) ──────────────── */}
              {outcome?.kind === 'nudged' && (
                <div className="mt-3">
                  <NudgeConfirmation message={outcome.message} />
                </div>
              )}

              {/* Article URL input — posts with sources rank higher */}
              {showUrlInput && (
                <div className="mt-3 animate-fade-in">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface border border-border-subtle rounded-xl">
                    <Link2 className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden />
                    <input
                      type="url"
                      value={articleUrl}
                      onChange={(e) => dispatch({ type: 'SET_ARTICLE_URL', payload: e.target.value })}
                      placeholder="Add a source URL — posts with sources rank higher"
                      aria-label="Source URL"
                      className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    {articleUrl && (
                      <button
                        onClick={() => dispatch({ type: 'CLEAR_URL' })}
                        aria-label="Clear source URL"
                        className="text-text-muted hover:text-text-primary flex items-center justify-center shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {articleUrl && (
                    <div className="mt-2 p-3 bg-surface-elevated rounded-xl border border-border-subtle">
                      <p className="text-xs font-semibold text-text-muted mb-1">Source Preview</p>
                      <p className="text-sm text-civic-light truncate">{articleUrl}</p>
                      <p className="text-xs text-text-muted mt-0.5">This source will be attached to your post.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Hashtag / topics input */}
              {showTopics && (
                <div className="mt-3 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-1 px-3 py-2 bg-surface border border-border-subtle rounded-xl">
                      <Hash className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden />
                      <input
                        type="text"
                        value={hashtagInput}
                        onChange={(e) => dispatch({ type: 'SET_HASHTAG_INPUT', payload: e.target.value.replace(/\s/g, '') })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'ADD_HASHTAG', payload: hashtagInput }); } }}
                        placeholder="Add a custom topic…"
                        aria-label="Add a topic"
                        className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'ADD_HASHTAG', payload: hashtagInput })}
                      disabled={!hashtagInput.trim()}
                      className="px-3 py-2 bg-civic-subtle text-civic-light text-xs font-semibold rounded-xl hover:bg-civic-muted transition-colors disabled:opacity-40 min-h-[40px]"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-text-muted mr-0.5">Topics</span>
                    {SUGGESTED_TOPICS.map((topic) => {
                      const active = selectedTopics.includes(topic);
                      return (
                        <button
                          key={topic}
                          onClick={() => dispatch({ type: 'TOGGLE_TOPIC', payload: topic })}
                          aria-pressed={active}
                          className={clsx(
                            'text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                            active
                              ? 'bg-civic-muted text-civic-light border-civic'
                              : 'bg-transparent text-text-muted border-border-subtle hover:text-text-primary',
                          )}
                        >
                          #{topic}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {submitError && (
                <div role="alert" className="mt-3 p-3 rounded-xl border border-danger/30 bg-danger/10 text-danger-light text-xs">
                  {submitError}
                </div>
              )}
            </div>{/* end body */}

            {/* ── Toolbar ─────────────────────────────────────── */}
            <div className="shrink-0 flex items-center gap-0.5 px-3 py-2 border-t border-border-hairline bg-bg sm:bg-bg-alt">
              {/* Left: action icons */}
              <button
                onClick={() => dispatch({ type: 'TOGGLE_URL_INPUT' })}
                aria-label="Attach a source"
                aria-pressed={showUrlInput}
                className={clsx(
                  'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
                  showUrlInput ? 'text-civic-light bg-civic-subtle' : 'text-civic-light/70 hover:bg-civic-subtle',
                )}
              >
                <Link2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_TOPICS' })}
                aria-label="Add topics"
                aria-pressed={showTopics}
                className={clsx(
                  'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
                  showTopics ? 'text-civic-light bg-civic-subtle' : 'text-civic-light/70 hover:bg-civic-subtle',
                )}
              >
                <Hash className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  const textarea = textareaRef.current;
                  if (!textarea) return;
                  const pos = textarea.selectionStart;
                  const before = content.slice(0, pos);
                  const after = content.slice(pos);
                  const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
                  const newContent = before + (needsSpace ? ' @' : '@') + after;
                  handleContentChange(newContent);
                  requestAnimationFrame(() => {
                    const newPos = pos + (needsSpace ? 2 : 1);
                    textarea.setSelectionRange(newPos, newPos);
                    textarea.focus();
                  });
                }}
                aria-label="Mention someone"
                className="w-11 h-11 flex items-center justify-center rounded-full transition-colors text-civic-light/70 hover:bg-civic-subtle"
              >
                <AtSign className="w-5 h-5" />
              </button>

              <div className="w-px h-5 bg-border-subtle mx-1" />

              {/* Reply policy picker */}
              <div className="relative" data-menu>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_REPLY_MENU' })}
                  aria-label="Who can reply"
                  aria-haspopup="menu"
                  aria-expanded={showReplyMenu}
                  className="flex items-center gap-1 text-xs font-medium text-civic-light hover:text-civic transition-colors h-11 px-2"
                >
                  {commentPolicy === 'everyone' && <Globe className="w-3.5 h-3.5" aria-hidden />}
                  {commentPolicy === 'followers_only' && <Users className="w-3.5 h-3.5" aria-hidden />}
                  {commentPolicy === 'off' && <Lock className="w-3.5 h-3.5" aria-hidden />}
                  <ChevronDown className="w-3 h-3" aria-hidden />
                </button>
                {showReplyMenu && (
                  <div role="menu" className="absolute bottom-full left-0 mb-2 w-52 bg-bg-alt border border-border-subtle rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                    {[
                      { value: 'everyone' as const, icon: Globe, label: 'Everyone', desc: 'Anyone can reply' },
                      { value: 'followers_only' as const, icon: Users, label: 'Followers', desc: 'Only followers can reply' },
                      { value: 'off' as const, icon: Lock, label: 'No one', desc: 'Replies turned off' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        role="menuitemradio"
                        aria-checked={commentPolicy === opt.value}
                        onClick={() => dispatch({ type: 'SET_COMMENT_POLICY', payload: opt.value })}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors',
                          commentPolicy === opt.value && 'bg-civic-subtle',
                        )}
                      >
                        <opt.icon className={clsx('w-4 h-4', commentPolicy === opt.value ? 'text-civic-light' : 'text-text-muted')} aria-hidden />
                        <div>
                          <p className={clsx('text-xs font-medium', commentPolicy === opt.value ? 'text-civic-light' : 'text-text-primary')}>{opt.label}</p>
                          <p className="text-xs text-text-muted">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Post type quick picker (mirrors the pill row) */}
              <div className="relative" data-menu>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_TYPE_MENU' })}
                  aria-label="Post type"
                  aria-haspopup="menu"
                  aria-expanded={showTypeMenu}
                  className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-civic-light transition-colors h-11 px-2"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden />
                  <span className="hidden sm:inline">{activeType.label}</span>
                  <ChevronDown className="w-3 h-3" aria-hidden />
                </button>
                {showTypeMenu && (
                  <div role="menu" className="absolute bottom-full left-0 mb-2 w-48 bg-bg-alt border border-border-subtle rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                    {POST_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        role="menuitemradio"
                        aria-checked={postType === opt.value}
                        onClick={() => dispatch({ type: 'SET_POST_TYPE', payload: opt.value })}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors',
                          postType === opt.value && 'bg-civic-subtle',
                        )}
                      >
                        <span className="text-sm" aria-hidden>{opt.icon}</span>
                        <p className={clsx('text-xs font-medium', postType === opt.value ? 'text-civic-light' : 'text-text-primary')}>{opt.label}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: char counter ring + Post */}
              <div className="ml-auto flex items-center gap-2.5">
                {charCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-[22px] h-[22px] -rotate-90" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface-active" />
                      <circle
                        cx="12" cy="12" r="10" fill="none" strokeWidth="2.5"
                        strokeDasharray={`${Math.min(charCount / MAX_CHARS, 1) * 62.83} 62.83`}
                        strokeLinecap="round"
                        className={clsx(
                          'transition-colors',
                          charCount > MAX_CHARS ? 'text-danger' : charCount >= MAX_CHARS * 0.9 ? 'text-warning' : 'text-civic',
                        )}
                      />
                    </svg>
                    {charsLeft <= MAX_CHARS * 0.2 && (
                      <span
                        className={clsx(
                          'text-xs font-semibold font-mono tabular-nums',
                          charsLeft < 0 ? 'text-danger-light' : charsLeft < MAX_CHARS * 0.1 ? 'text-warning-light' : 'text-text-muted',
                        )}
                        aria-label={`${charsLeft} characters remaining`}
                      >
                        {charsLeft}
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={handlePost}
                  disabled={!canPost}
                  className={clsx(
                    'flex items-center justify-center gap-2 px-[22px] py-2.5 rounded-full text-sm font-bold transition-[filter,background-color] min-h-[40px] min-w-[80px]',
                    canPost
                      ? 'bg-civic text-[#16130d] hover:brightness-110'
                      : 'bg-surface-elevated text-text-muted cursor-not-allowed',
                  )}
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Posting" /> : 'Post'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
