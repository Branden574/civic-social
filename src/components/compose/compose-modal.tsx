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
import { analyzeCivility } from '@/lib/civility';
import { AtSign } from 'lucide-react';

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


export function ComposeModal({ isOpen, onClose, onPostCreated }: ComposeModalProps) {
  const { addPost, confirmPost, removePost } = usePostStore();
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; displayName: string; username: string; avatarUrl?: string }[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
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

  // Detect @mention trigger as user types
  const handleContentChange = useCallback((value: string) => {
    setContent(value);

    // Check if cursor is right after @something
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);

    // Find the last @ before cursor that's not preceded by a word char
    const mentionMatch = textBefore.match(/(?:^|[\s,.()!?])@([a-zA-Z0-9._-]{0,30})$/);
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query); // show suggestions even on bare @ (empty string)
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, []);

  // Search users when mention query changes (including empty string for bare @)
  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    const controller = new AbortController();
    // Shorter debounce for snappier feel; bare @ is instant
    const delay = mentionQuery.length === 0 ? 50 : 120;
    const timer = setTimeout(async () => {
      setMentionLoading(true);
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(mentionQuery)}&limit=6&scope=global`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setMentionResults(data.users || []);
        }
      } catch {
        // aborted or failed
      } finally {
        setMentionLoading(false);
      }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mentionQuery]);

  // Insert a mention from autocomplete
  const insertMention = useCallback((username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);

    // Find the @ that started this mention
    const mentionMatch = textBefore.match(/(?:^|[\s,.()!?])@([a-zA-Z0-9._-]{0,30})$/);
    if (!mentionMatch) return;

    const atPos = textBefore.lastIndexOf('@' + mentionMatch[1]);
    const newText = textBefore.slice(0, atPos) + '@' + username + ' ' + textAfter;
    setContent(newText);
    setMentionQuery(null);
    setMentionResults([]);

    // Restore cursor position after React re-renders
    requestAnimationFrame(() => {
      const newCursor = atPos + username.length + 2; // +2 for @ and space
      textarea.setSelectionRange(newCursor, newCursor);
      textarea.focus();
    });
  }, [content]);

  // Handle keyboard navigation in mention dropdown
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionResults.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx(prev => Math.min(prev + 1, mentionResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIdx].username);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
      }
    }
  }, [mentionResults, mentionQuery, mentionIdx, insertMention]);

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
    setSubmitError(null);

    const allTopics = [...selectedTopics, ...customHashtags];
    const safeArticleUrl = articleUrl || undefined;

    let newPost: ReturnType<typeof addPost> | null = null;

    try {
      // ─── Optimistic UI: insert post immediately ──────────
      newPost = addPost({
        content: content.trim(),
        topics: allTopics,
        articleUrl: safeArticleUrl,
        civilityScore: civility.score,
      });

      // ─── Server persistence ─────────────────────────────
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          topics: allTopics,
          articleUrl: safeArticleUrl,
          comment_policy: commentPolicy,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If 401, the session expired — show a specific message
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error(err.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      // Mark post as confirmed with server-assigned data
      confirmPost(newPost.id, data.post);
      // Notify parent only after confirmed persistence
      onPostCreated?.();
      // Reset form + close after successful persistence
      setContent('');
      setArticleUrl('');
      setSelectedTopics([]);
      setCustomHashtags([]);
      setShowCivilityCheck(false);
      setCommentPolicy('everyone');
      onClose();
    } catch (err) {
      // Server failed — remove optimistic post so UI never shows a ghost post
      if (newPost) removePost(newPost.id);
      const msg = err instanceof Error ? err.message : 'Post failed to publish. Please try again.';
      setSubmitError(msg);
    } finally {
      setPosting(false);
    }
  }, [content, selectedTopics, customHashtags, articleUrl, civility.score, commentPolicy, addPost, confirmPost, removePost, onClose, onPostCreated]);

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
            {user?.avatar ? (
              <img src={user.avatar} alt={user.displayName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border-subtle" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-civic/20 flex items-center justify-center text-civic-light text-sm font-semibold shrink-0">
                {user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </div>
            )}
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
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Share your perspective... What policy matters to you? Link an article. @mention someone."
              className="w-full mt-3 bg-transparent text-text-primary text-[15px] leading-relaxed placeholder:text-text-muted resize-none focus:outline-none min-h-[120px]"
              maxLength={maxChars}
              autoFocus
            />

            {/* @mention autocomplete dropdown */}
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
                    Article URL will be attached to your post
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

          {submitError && (
            <div className="mt-3 p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger-light text-xs">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
          <div className="flex items-center gap-1.5 sm:gap-2">
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
            <button
              onClick={() => {
                // Insert @ at cursor position
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
              className="p-2 rounded-lg transition-colors text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              title="Mention someone"
            >
              <AtSign className="w-4.5 h-4.5" />
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
