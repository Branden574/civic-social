'use client';

import { useReducer, useRef, useEffect, useCallback, useState } from 'react';
import {
  X,
  Link2,
  Hash,
  Shield,
  AlertTriangle,
  CheckCircle2,
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
import { analyzeCivility } from '@/lib/civility';

// ─── Props ────────────────────────────────────────────────────

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  initialArticleUrl?: string;
  initialContent?: string;
}

// ─── Constants ────────────────────────────────────────────────

const POST_TYPE_OPTIONS = [
  { value: 'OPEN_DISCUSSION', label: 'Discussion', icon: '💬' },
  { value: 'POLICY_PROPOSAL', label: 'Policy Proposal', icon: '📋' },
  { value: 'NEWS_DISCUSSION', label: 'News Discussion', icon: '📰' },
  { value: 'STRUCTURED_DEBATE', label: 'Debate', icon: '⚖️' },
  { value: 'CROSS_PARTY_ROUNDTABLE', label: 'Cross-Party', icon: '🤝' },
  { value: 'EXPERT_AMA', label: 'Expert Q&A', icon: '🎓' },
];

const SUGGESTED_TOPICS = [
  'healthcare', 'economy', 'climate', 'education', 'immigration',
  'criminal-justice', 'technology', 'defense', 'infrastructure',
  'housing', 'elections', 'foreign-policy', 'civil-rights', 'taxation',
];

const MAX_CHARS = 2000;

// ─── Reducer ──────────────────────────────────────────────────

interface ComposeState {
  content: string;
  articleUrl: string;
  showUrlInput: boolean;
  selectedTopics: string[];
  showTopics: boolean;
  hashtagInput: string;
  customHashtags: string[];
  civility: { score: number; issues: string[] };
  showCivilityCheck: boolean;
  posting: boolean;
  commentPolicy: 'everyone' | 'followers_only' | 'off';
  postType: string;
  showTypeMenu: boolean;
  showReplyMenu: boolean;
  submitError: string | null;
  closing: boolean;
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
  | { type: 'SET_CIVILITY'; payload: { score: number; issues: string[] } }
  | { type: 'TOGGLE_CIVILITY_CHECK' }
  | { type: 'SET_POSTING'; payload: boolean }
  | { type: 'SET_COMMENT_POLICY'; payload: 'everyone' | 'followers_only' | 'off' }
  | { type: 'SET_POST_TYPE'; payload: string }
  | { type: 'TOGGLE_TYPE_MENU' }
  | { type: 'TOGGLE_REPLY_MENU' }
  | { type: 'CLOSE_MENUS' }
  | { type: 'SET_SUBMIT_ERROR'; payload: string | null }
  | { type: 'SET_CLOSING'; payload: boolean }
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
  civility: { score: 1, issues: [] },
  showCivilityCheck: false,
  posting: false,
  commentPolicy: 'everyone',
  postType: 'OPEN_DISCUSSION',
  showTypeMenu: false,
  showReplyMenu: false,
  submitError: null,
  closing: false,
};

function composeReducer(state: ComposeState, action: ComposeAction): ComposeState {
  switch (action.type) {
    case 'SET_CONTENT':
      return { ...state, content: action.payload };
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
    case 'SET_CIVILITY':
      return {
        ...state,
        civility: action.payload,
        // Auto-show the detailed civility panel when issues are detected
        showCivilityCheck: action.payload.issues.length > 0 ? true : state.showCivilityCheck,
      };
    case 'TOGGLE_CIVILITY_CHECK':
      return { ...state, showCivilityCheck: !state.showCivilityCheck };
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

// ─── Component ────────────────────────────────────────────────

export function ComposeModal({ isOpen, onClose, onPostCreated, initialArticleUrl, initialContent }: ComposeModalProps) {
  const { addPost, confirmPost, removePost } = usePostStore();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(composeReducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention state (kept as useState — tightly coupled to async search)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; displayName: string; username: string; avatarUrl?: string }[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);

  const {
    content, articleUrl, showUrlInput, selectedTopics, showTopics,
    hashtagInput, customHashtags, civility, showCivilityCheck,
    posting, commentPolicy, postType, showTypeMenu, showReplyMenu,
    submitError, closing,
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

  // ── Civility check (debounced) ────────────────────────────
  useEffect(() => {
    if (content.length < 10) {
      dispatch({ type: 'SET_CIVILITY', payload: { score: 1, issues: [] } });
      return;
    }
    const timer = setTimeout(() => {
      const result = analyzeCivility(content);
      dispatch({ type: 'SET_CIVILITY', payload: result });
    }, 500);
    return () => clearTimeout(timer);
  }, [content]);

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

  // ── Keyboard: mention nav + Cmd+Enter ─────────────────────
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention dropdown navigation
    if (mentionResults.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(prev => Math.min(prev + 1, mentionResults.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(prev => Math.max(prev - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionResults[mentionIdx].username); return; }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionResults([]); return; }
    }
    // Cmd/Ctrl+Enter to post
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && content.trim() && !posting) {
      e.preventDefault();
      handlePost();
    }
  }, [mentionResults, mentionQuery, mentionIdx, insertMention, content, posting]);

  // ── Close with animation ──────────────────────────────────
  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_CLOSING', payload: true });
    setTimeout(() => {
      dispatch({ type: 'SET_CLOSING', payload: false });
      dispatch({ type: 'RESET' });
      setMentionQuery(null);
      setMentionResults([]);
      onClose();
    }, 250);
  }, [onClose]);

  // ── Submit post ───────────────────────────────────────────
  const handlePost = useCallback(async () => {
    if (!content.trim() || posting) return;
    dispatch({ type: 'SET_POSTING', payload: true });
    dispatch({ type: 'SET_SUBMIT_ERROR', payload: null });

    const allTopics = [...selectedTopics, ...customHashtags];
    const safeArticleUrl = articleUrl || undefined;

    let newPost: ReturnType<typeof addPost> | null = null;

    try {
      newPost = addPost({
        content: content.trim(),
        topics: allTopics,
        articleUrl: safeArticleUrl,
        civilityScore: civility.score,
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      confirmPost(newPost.id, data.post);
      onPostCreated?.();

      // Close with animation after success
      dispatch({ type: 'SET_CLOSING', payload: true });
      setTimeout(() => {
        dispatch({ type: 'SET_CLOSING', payload: false });
        dispatch({ type: 'RESET' });
        setMentionQuery(null);
        setMentionResults([]);
        onClose();
      }, 250);
    } catch (err) {
      if (newPost) removePost(newPost.id);
      const msg = err instanceof Error ? err.message : 'Post failed to publish. Please try again.';
      dispatch({ type: 'SET_SUBMIT_ERROR', payload: msg });
      dispatch({ type: 'SET_POSTING', payload: false });
    }
  }, [content, selectedTopics, customHashtags, articleUrl, civility.score, commentPolicy, postType, addPost, confirmPost, removePost, onClose, onPostCreated]);

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

  if (!isOpen && !closing) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          closing ? 'opacity-0' : 'opacity-100',
          'hidden sm:block',
        )}
        onClick={handleClose}
      />

      {/* Modal container — safe-area on this element, not children */}
      <div
        className={clsx(
          'relative w-full sm:max-w-xl bg-bg sm:bg-bg-alt overflow-hidden flex flex-col',
          // Mobile: full screen with dvh, Desktop: centered card
          'h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-border-subtle',
          // Safe-area insets on the container
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'sm:pt-0 sm:pb-0',
          // Animation
          closing
            ? 'animate-bottom-sheet-down sm:animate-shared-collapse'
            : 'animate-bottom-sheet-up sm:animate-shared-expand',
        )}
      >
        {/* ── Header: Cancel left, Post right ────────────────── */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0 border-b border-border-subtle">
          <button
            onClick={handleClose}
            className="text-[15px] font-medium text-text-secondary hover:text-text-primary transition-colors min-h-[44px] flex items-center"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={!content.trim() || posting}
            className={clsx(
              'px-5 py-1.5 rounded-full text-sm font-bold transition-all min-h-[36px]',
              content.trim() && !posting
                ? 'bg-civic text-white hover:bg-civic-dark active:scale-95'
                : 'bg-surface-active text-text-muted cursor-not-allowed',
            )}
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        </div>

        {/* ── Body: avatar + textarea ────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="shrink-0 pt-0.5">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.displayName} className="w-10 h-10 rounded-full object-cover border border-border-subtle" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-civic/20 flex items-center justify-center text-civic-light text-sm font-semibold">
                  {user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* Content column */}
            <div className="flex-1 min-w-0">
              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="What's happening?"
                  className="w-full bg-transparent text-text-primary text-[15px] leading-relaxed placeholder:text-text-muted/60 resize-none border-none focus:outline-none focus:ring-0 min-h-[100px] sm:min-h-[120px]"
                  maxLength={MAX_CHARS}
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
                          i === mentionIdx ? 'bg-civic/10' : 'hover:bg-surface-hover',
                        )}
                      >
                        {u.avatarUrl ? (
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

              {/* Article URL input */}
              {showUrlInput && (
                <div className="mt-3 animate-fade-in">
                  <div className="flex items-center gap-2 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
                    <Globe className="w-4 h-4 text-text-muted shrink-0" />
                    <input
                      type="url"
                      value={articleUrl}
                      onChange={(e) => dispatch({ type: 'SET_ARTICLE_URL', payload: e.target.value })}
                      placeholder="Paste article URL..."
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    {articleUrl && (
                      <button onClick={() => dispatch({ type: 'CLEAR_URL' })} className="text-text-muted hover:text-text-primary min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {articleUrl && (
                    <div className="mt-2 p-3 bg-surface rounded-lg border border-border-subtle">
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Article Preview</p>
                      <p className="text-sm text-civic-light truncate">{articleUrl}</p>
                      <p className="text-xs text-text-muted mt-0.5">Article URL will be attached to your post</p>
                    </div>
                  )}
                </div>
              )}

              {/* Hashtag input */}
              {showTopics && (
                <div className="mt-3 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-1 p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                      <Hash className="w-4 h-4 text-text-muted shrink-0" />
                      <input
                        type="text"
                        value={hashtagInput}
                        onChange={(e) => dispatch({ type: 'SET_HASHTAG_INPUT', payload: e.target.value.replace(/\s/g, '') })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'ADD_HASHTAG', payload: hashtagInput }); } }}
                        placeholder="Add custom hashtag..."
                        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'ADD_HASHTAG', payload: hashtagInput })}
                      disabled={!hashtagInput.trim()}
                      className="px-3 py-2 bg-civic/10 text-civic-light text-xs font-semibold rounded-lg hover:bg-civic/20 transition-colors disabled:opacity-40 min-h-[44px]"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Suggested Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_TOPICS.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => dispatch({ type: 'TOGGLE_TOPIC', payload: topic })}
                        className={clsx(
                          'text-[11px] font-medium px-2 py-1 rounded-full transition-all min-h-[32px]',
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

              {/* Selected tags */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {allTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-[11px] font-medium text-civic-light bg-civic/10 px-2 py-0.5 rounded-full">
                      #{tag}
                      <button
                        onClick={() => {
                          if (selectedTopics.includes(tag)) dispatch({ type: 'TOGGLE_TOPIC', payload: tag });
                          else dispatch({ type: 'REMOVE_HASHTAG', payload: tag });
                        }}
                        className="hover:text-danger-light"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}


            </div> {/* end content column */}
          </div> {/* end flex row (avatar + content) */}

          {/* Civility check — full width, below the avatar+text row */}
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
                        civility.score >= 0.8 ? 'bg-positive' : civility.score >= 0.5 ? 'bg-warning' : 'bg-danger',
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

          {submitError && (
            <div className="mt-3 p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger-light text-xs">
              {submitError}
            </div>
          )}
        </div> {/* end body */}

        {/* ── Toolbar: merged single bar ─────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-4 h-12 border-t border-border-subtle bg-bg sm:bg-bg-alt">
          {/* Left: action icons */}
          <div className="flex items-center gap-0">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_URL_INPUT' })}
              className={clsx(
                'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
                showUrlInput ? 'text-civic-light bg-civic/10' : 'text-civic-light/70 hover:bg-civic/10',
              )}
              title="Attach article"
            >
              <Link2 className="w-[20px] h-[20px]" />
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_TOPICS' })}
              className={clsx(
                'w-11 h-11 flex items-center justify-center rounded-full transition-colors',
                showTopics ? 'text-civic-light bg-civic/10' : 'text-civic-light/70 hover:bg-civic/10',
              )}
              title="Add hashtags"
            >
              <Hash className="w-[20px] h-[20px]" />
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
              className="w-11 h-11 flex items-center justify-center rounded-full transition-colors text-civic-light/70 hover:bg-civic/10"
              title="Mention someone"
            >
              <AtSign className="w-[20px] h-[20px]" />
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-border-subtle mx-1" />

            {/* Reply policy picker */}
            <div className="relative" data-menu>
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_REPLY_MENU' })}
                className="flex items-center gap-1 text-[11px] font-medium text-civic-light hover:text-civic transition-colors h-11 px-2"
              >
                {commentPolicy === 'everyone' && <Globe className="w-3.5 h-3.5" />}
                {commentPolicy === 'followers_only' && <Users className="w-3.5 h-3.5" />}
                {commentPolicy === 'off' && <Lock className="w-3.5 h-3.5" />}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showReplyMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-bg-alt border border-border-subtle rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                  {[
                    { value: 'everyone' as const, icon: Globe, label: 'Everyone', desc: 'Anyone can reply' },
                    { value: 'followers_only' as const, icon: Users, label: 'Followers', desc: 'Only followers can reply' },
                    { value: 'off' as const, icon: Lock, label: 'No one', desc: 'Replies turned off' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => dispatch({ type: 'SET_COMMENT_POLICY', payload: opt.value })}
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

            {/* Post type picker */}
            <div className="relative" data-menu>
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_TYPE_MENU' })}
                className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-civic-light transition-colors h-11 px-2"
              >
                <FileText className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTypeMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-bg-alt border border-border-subtle rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                  {POST_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => dispatch({ type: 'SET_POST_TYPE', payload: opt.value })}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors',
                        postType === opt.value && 'bg-civic/5',
                      )}
                    >
                      <span className="text-sm">{opt.icon}</span>
                      <p className={clsx('text-xs font-medium', postType === opt.value ? 'text-civic-light' : 'text-text-primary')}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: civility + char count */}
          <div className="flex items-center gap-2">
            {content.length > 10 && (
              <button
                onClick={() => dispatch({ type: 'TOGGLE_CIVILITY_CHECK' })}
                className={clsx(
                  'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full transition-colors',
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
            <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-active" />
              <circle
                cx="12" cy="12" r="10" fill="none" strokeWidth="2"
                strokeDasharray={`${(charCount / MAX_CHARS) * 62.83} 62.83`}
                strokeLinecap="round"
                className={clsx(
                  charCount > MAX_CHARS * 0.9 ? 'text-danger' : charCount > MAX_CHARS * 0.7 ? 'text-warning' : 'text-civic',
                )}
              />
            </svg>
            {charCount > MAX_CHARS * 0.8 && (
              <span className={clsx(
                'text-xs font-mono',
                charCount > MAX_CHARS * 0.9 ? 'text-danger-light' : 'text-text-muted',
              )}>
                {MAX_CHARS - charCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
