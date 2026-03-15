'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Shield, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────

interface ReplySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
  replyingTo?: {
    displayName: string;
    content: string;
  };
}

// ─── Civility check (simplified) ─────────────────────────────

function quickCivilityCheck(text: string): number {
  if (text.length < 5) return 1;
  let score = 1;
  const lower = text.toLowerCase();
  if (/\b(stupid|dumb|idiot|moron|shut up)\b/i.test(lower)) score -= 0.3;
  if (/!!!+/.test(text)) score -= 0.1;
  if ((text.replace(/[^A-Z]/g, '').length) / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1) > 0.5 && text.length > 20) score -= 0.2;
  if (/\b(I think|however|in my view|fair point|source)\b/i.test(text)) score += 0.1;
  return Math.max(0, Math.min(1, score));
}

// ─── Component ───────────────────────────────────────────────

export function ReplySheet({ isOpen, onClose, onSubmit, replyingTo }: ReplySheetProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const civility = quickCivilityCheck(content);

  // Auto-focus textarea when sheet opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [content]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setContent('');
      onClose();
    }, 250);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      onSubmit(content.trim());
    } finally {
      setSending(false);
      setContent('');
      handleClose();
    }
  }, [content, sending, onSubmit, handleClose]);

  if (!isOpen && !closing) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 backdrop-sheet transition-opacity',
          closing ? 'opacity-0 duration-200' : 'opacity-100 duration-300',
        )}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={clsx(
          'relative w-full sm:max-w-xl bg-bg-alt rounded-t-2xl sm:rounded-2xl sm:mb-4 border border-border-subtle overflow-hidden flex flex-col max-h-[80vh]',
          closing ? 'animate-bottom-sheet-down' : 'animate-bottom-sheet-up',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors duration-150"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-text-primary">Reply</span>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || sending}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200',
              content.trim() && !sending
                ? 'bg-civic text-white hover:bg-civic-dark'
                : 'bg-surface-active text-text-muted cursor-not-allowed',
            )}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Reply
              </>
            )}
          </button>
        </div>

        {/* Replying to context */}
        {replyingTo && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-start gap-2 p-2.5 bg-surface rounded-xl border border-border-subtle">
              <div className="w-0.5 h-full bg-civic/30 rounded-full shrink-0 self-stretch" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-muted">
                  Replying to {replyingTo.displayName}
                </p>
                <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                  {replyingTo.content}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Textarea */}
        <div className="flex-1 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughtful reply..."
            className="w-full bg-transparent text-text-primary text-base leading-relaxed placeholder:text-text-muted resize-none focus:outline-none min-h-[80px]"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            {content.length > 5 && (
              <div
                className={clsx(
                  'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors duration-200',
                  civility >= 0.8
                    ? 'bg-positive/10 text-positive-light'
                    : civility >= 0.5
                      ? 'bg-warning/10 text-warning-light'
                      : 'bg-danger/10 text-danger-light',
                )}
              >
                <Shield className="w-3 h-3" />
                {Math.round(civility * 100)}%
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'text-xs font-mono',
                content.length > 900 ? 'text-danger-light' : content.length > 700 ? 'text-warning-light' : 'text-text-muted',
              )}
            >
              {content.length}/1000
            </span>
            <span className="text-xs text-text-muted">
              ⌘+Enter to submit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
