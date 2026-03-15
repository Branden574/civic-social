'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — Live Debate Chat (YouTube/Twitch-Style)
// ═══════════════════════════════════════════════════════════════
//
// Real-time text chat for live debates. Features:
//   - Auto-scrolling message feed with smooth animations
//   - Side-color-coded messages (Side A / Side B / Spectator)
//   - Pinned messages bar
//   - Emoji quick-reactions
//   - Host moderation controls (delete msg, mute user, pin)
//   - Slow mode indicator
//   - System messages (join, stage change, etc.)
//   - Chat stats (messages/min, unique users)
//   - Collapsible for mobile
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Pin,
  Trash2,
  VolumeX,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Smile,
  X,
  Users,
  BarChart3,
  Clock,
  Shield,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  debateId: string;
  userId: string;
  displayName: string;
  type: 'user' | 'system' | 'reaction' | 'pinned';
  content: string;
  side?: 'A' | 'B' | null;
  replyToId?: string;
  reactions: Record<string, number>;
  pinned: boolean;
  deleted: boolean;
  createdAt: string;
}

interface ChatConfig {
  debateId: string;
  enabled: boolean;
  slowModeSeconds: number;
  subscribersOnly: boolean;
  autoClearOnEnd: boolean;
  retentionHours: number | null;
}

interface ChatStats {
  totalMessages: number;
  uniqueUsers: number;
  messagesPerMinute: number;
  topReaction: string | null;
}

interface LiveChatProps {
  debateId: string;
  debateStatus: 'waiting' | 'live' | 'paused' | 'completed';
  isCreator: boolean;
  currentUserId: string;
  spectatorCount?: number;
  debaterCount?: number;
}

// ─── Quick reaction emojis ──────────────────────────────────────

const QUICK_REACTIONS = ['👏', '🔥', '💯', '🤔', '👎', '❤️', '😂', '⚡'];

// ─── Side colors ────────────────────────────────────────────────

function getSideColor(side?: 'A' | 'B' | null): string {
  if (side === 'A') return 'text-info-light';
  if (side === 'B') return 'text-purple-400';
  return 'text-text-muted';
}

function getSideBadge(side?: 'A' | 'B' | null): string | null {
  if (side === 'A') return 'A';
  if (side === 'B') return 'B';
  return null;
}

// ─── Component ──────────────────────────────────────────────────

export function LiveChat({ debateId, debateStatus, isCreator, currentUserId, spectatorCount, debaterCount }: LiveChatProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [chatCleared, setChatCleared] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch messages (polling) ────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const sinceParam = lastFetchRef.current ? `&since=${encodeURIComponent(lastFetchRef.current)}` : '';
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/chat?limit=200${sinceParam}&_t=${Date.now()}`);
      if (!res.ok) return;

      const data = await res.json();

      if (lastFetchRef.current && data.messages?.length > 0) {
        // Incremental: append new messages
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs].slice(-500); // keep last 500
        });
      } else if (!lastFetchRef.current) {
        // Initial fetch
        setMessages(data.messages || []);
      }

      setPinnedMessages(data.pinned || []);
      setConfig(data.config || null);
      setStats(data.stats || null);
      setIsMuted(data.isMuted || false);
      lastFetchRef.current = data.serverTime;
      setChatCleared(false);
    } catch {
      // Silently fail on poll
    }
  }, [debateId]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll every 1.5 seconds for near-real-time chat
  useEffect(() => {
    if (debateStatus === 'completed' && chatCleared) return;
    const interval = setInterval(fetchMessages, 1500);
    return () => clearInterval(interval);
  }, [fetchMessages, debateStatus, chatCleared]);

  // ── Auto-scroll ─────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect manual scroll (disable auto-scroll if user scrolls up)
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  // ── Send message ────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send message.');
        return;
      }

      setInputValue('');
      if (data.message) {
        setMessages((prev) => [...prev, data.message].slice(-500));
      }
      if (data.filtered) {
        setError('Some words were filtered.');
        setTimeout(() => setError(null), 2000);
      }
      setAutoScroll(true);
    } catch {
      setError('Network error.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, sending, debateId]);

  // ── Moderation actions ──────────────────────────────────────
  const moderateAction = useCallback(async (action: string, extra: Record<string, string> = {}) => {
    try {
      await fetch(`/api/debates/${encodeURIComponent(debateId)}/chat`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      fetchMessages();
    } catch { /* ignore */ }
  }, [debateId, fetchMessages]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    moderateAction('react', { messageId, emoji });
    setShowEmoji(false);
  }, [moderateAction]);

  // ── Clear chat ──────────────────────────────────────────────
  const handleClearChat = useCallback(async () => {
    if (!confirm('Clear all chat messages? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/chat`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setPinnedMessages([]);
        setChatCleared(true);
        lastFetchRef.current = '';
      }
    } catch { /* ignore */ }
  }, [debateId]);

  // ── Update chat config ──────────────────────────────────────
  const updateConfig = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/chat`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_config', ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch { /* ignore */ }
  }, [debateId]);

  // ── Keyboard shortcut ──────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Chat disabled state ────────────────────────────────────
  const chatDisabled = config?.enabled === false || isMuted;
  const isCompleted = debateStatus === 'completed';

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  return (
    <div className={clsx(
      'flex flex-col bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden transition-colors',
      collapsed ? 'h-12' : 'h-[500px] lg:h-[600px]',
    )}>
      {/* ── Chat header ── */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle cursor-pointer hover:bg-surface-hover transition-colors shrink-0"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-civic-light" />
          <span className="text-xs font-semibold text-text-primary">Live Chat</span>
          <span className="text-xs text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full">Everyone</span>
          {(spectatorCount !== undefined || debaterCount !== undefined) && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Users className="w-2.5 h-2.5" />
              {((spectatorCount || 0) + (debaterCount || 0)).toLocaleString()} watching
            </span>
          )}
          {config?.slowModeSeconds && config.slowModeSeconds > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-warning-light bg-warning/10 px-1.5 py-0.5 rounded-full">
              <Clock className="w-2.5 h-2.5" />
              {config.slowModeSeconds}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isCreator && !collapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
              className={clsx('p-1 rounded text-text-muted hover:text-text-primary transition-colors', showSettings && 'text-civic-light')}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </div>

      {/* ── Content (hidden when collapsed) ── */}
      {!collapsed && (
        <>
          {/* ── Host settings panel ── */}
          {showSettings && isCreator && (
            <div className="px-3 py-2 border-b border-border-subtle bg-surface space-y-2 animate-fade-in shrink-0">
              <p className="text-xs font-semibold text-text-muted">Chat Settings</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateConfig({ enabled: !config?.enabled })}
                  className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                    config?.enabled ? 'bg-positive/10 text-positive-light border-positive/20' : 'bg-danger/10 text-danger-light border-danger/20')}
                >
                  Chat {config?.enabled ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => updateConfig({ slowModeSeconds: config?.slowModeSeconds ? 0 : 5 })}
                  className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                    config?.slowModeSeconds ? 'bg-warning/10 text-warning-light border-warning/20' : 'bg-surface-elevated text-text-muted border-border-subtle')}
                >
                  Slow Mode {config?.slowModeSeconds ? `${config.slowModeSeconds}s` : 'Off'}
                </button>
                <button
                  onClick={() => updateConfig({ autoClearOnEnd: !config?.autoClearOnEnd })}
                  className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                    config?.autoClearOnEnd ? 'bg-civic-subtle text-civic-light border-civic/20' : 'bg-surface-elevated text-text-muted border-border-subtle')}
                >
                  Auto-Clear {config?.autoClearOnEnd ? 'On' : 'Off'}
                </button>
                <button
                  onClick={handleClearChat}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-danger/20 bg-danger/10 text-danger-light hover:bg-danger/20 transition-colors"
                >
                  Clear Chat Now
                </button>
              </div>
            </div>
          )}

          {/* ── Pinned message bar ── */}
          {pinnedMessages.length > 0 && (
            <div className="px-3 py-2 border-b border-border-subtle bg-civic-subtle shrink-0">
              <div className="flex items-center gap-1.5">
                <Pin className="w-3 h-3 text-civic-light shrink-0" />
                <p className="text-xs text-text-primary font-medium truncate">
                  <span className="text-civic-light">{pinnedMessages[pinnedMessages.length - 1].displayName}:</span>{' '}
                  {pinnedMessages[pinnedMessages.length - 1].content}
                </p>
              </div>
            </div>
          )}

          {/* ── Messages area ── */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0"
          >
            {messages.length === 0 && !chatCleared && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <MessageSquare className="w-8 h-8 text-text-muted mb-2 opacity-40" />
                <p className="text-xs text-text-muted">
                  {isCompleted ? 'Chat has ended.' : 'No messages yet. Be the first to chat!'}
                </p>
              </div>
            )}

            {chatCleared && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Shield className="w-8 h-8 text-positive-light mb-2 opacity-60" />
                <p className="text-xs text-text-muted">Chat data has been cleared.</p>
                <p className="text-xs text-text-muted mt-1">All messages and logs have been permanently deleted.</p>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isCreator={isCreator}
                currentUserId={currentUserId}
                onDelete={(id) => moderateAction('delete_message', { messageId: id })}
                onPin={(id) => moderateAction('pin_message', { messageId: id })}
                onMute={(userId) => moderateAction('mute_user', { targetUserId: userId })}
                onReact={(id, emoji) => handleReaction(id, emoji)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Scroll-to-bottom button ── */}
          {!autoScroll && (
            <div className="px-3 pb-1 shrink-0">
              <button
                onClick={() => {
                  setAutoScroll(true);
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full text-center text-xs font-medium text-civic-light bg-civic-subtle rounded-xl py-1.5 hover:bg-civic-muted transition-colors"
              >
                <ChevronDown className="w-3 h-3 inline mr-1" />
                New messages below
              </button>
            </div>
          )}

          {/* ── Error message ── */}
          {error && (
            <div className="px-3 py-1.5 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-danger-light bg-danger/10 px-2.5 py-1.5 rounded-xl">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          {/* ── Input area ── */}
          <div className="px-3 py-2.5 border-t border-border-subtle bg-surface shrink-0">
            {isMuted ? (
              <div className="flex items-center gap-2 text-xs text-danger-light bg-danger/5 px-3 py-2 rounded-xl">
                <VolumeX className="w-4 h-4" />
                You are muted in this chat.
              </div>
            ) : !config?.enabled ? (
              <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-elevated px-3 py-2 rounded-xl">
                <MessageSquare className="w-4 h-4" />
                Chat is currently disabled.
              </div>
            ) : isCompleted ? (
              <div className="flex items-center gap-2 text-xs text-text-muted bg-surface-elevated px-3 py-2 rounded-xl">
                <MessageSquare className="w-4 h-4" />
                This debate has ended. Chat is read-only.
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className={clsx('p-1.5 rounded-xl transition-colors', showEmoji ? 'text-civic-light bg-civic-subtle' : 'text-text-muted hover:text-text-primary')}
                >
                  <Smile className="w-4 h-4" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Send a message..."
                  maxLength={500}
                  disabled={chatDisabled || sending}
                  className="flex-1 text-sm bg-surface-elevated border border-border-subtle rounded-xl px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/30 focus:border-civic/50 disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sending || chatDisabled}
                  className="p-2 rounded-xl bg-civic text-white hover:bg-civic-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* ── Quick emoji picker ── */}
            {showEmoji && !isCompleted && (
              <div className="flex flex-wrap gap-1.5 mt-2 animate-fade-in">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setInputValue((prev) => prev + emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                    className="text-lg hover:scale-125 transition-transform p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ChatMessageBubble ──────────────────────────────────────────

function ChatMessageBubble({
  message,
  isCreator,
  currentUserId,
  onDelete,
  onPin,
  onMute,
  onReact,
}: {
  message: ChatMessage;
  isCreator: boolean;
  currentUserId: string;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onMute: (userId: string) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isOwn = message.userId === currentUserId;
  const sideBadge = getSideBadge(message.side);
  const sideColor = getSideColor(message.side);

  // System messages
  if (message.type === 'system') {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1">
        <span className="text-xs text-text-muted italic">{message.content}</span>
      </div>
    );
  }

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="group flex items-start gap-2 py-1 px-1.5 rounded-xl hover:bg-surface-hover/50 transition-colors relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5',
        message.side === 'A' ? 'bg-info/15 text-info-light' :
        message.side === 'B' ? 'bg-purple-500/15 text-purple-400' :
        'bg-surface-active text-text-muted',
      )}>
        {message.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx('text-xs font-bold', sideColor)}>
            {message.displayName}
          </span>
          {sideBadge && (
            <span className={clsx(
              'text-[9px] font-bold px-1 py-0.5 rounded',
              message.side === 'A' ? 'bg-info/15 text-info-light' : 'bg-purple-500/15 text-purple-400',
            )}>
              Side {sideBadge}
            </span>
          )}
          {message.pinned && <Pin className="w-2.5 h-2.5 text-civic-light" />}
          <span className="text-[9px] text-text-muted">{time}</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed break-words">{message.content}</p>

        {/* Reactions */}
        {Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="flex items-center gap-0.5 text-xs bg-surface-active hover:bg-surface-hover px-1.5 py-0.5 rounded-full transition-colors"
              >
                {emoji} <span className="text-text-muted">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 bg-surface-elevated border border-border-subtle rounded-xl shadow-md px-1 py-0.5 animate-fade-in">
          {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="text-xs hover:scale-125 transition-transform p-0.5"
            >
              {emoji}
            </button>
          ))}
          {(isCreator || isOwn) && (
            <>
              <div className="w-px h-4 bg-border-subtle mx-0.5" />
              <button onClick={() => onDelete(message.id)} className="p-0.5 text-text-muted hover:text-danger-light transition-colors" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
          {isCreator && (
            <>
              <button onClick={() => onPin(message.id)} className="p-0.5 text-text-muted hover:text-civic-light transition-colors" title="Pin">
                <Pin className="w-3 h-3" />
              </button>
              {!isOwn && (
                <button onClick={() => onMute(message.userId)} className="p-0.5 text-text-muted hover:text-warning-light transition-colors" title="Mute user">
                  <VolumeX className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
