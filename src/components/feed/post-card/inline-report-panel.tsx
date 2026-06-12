'use client';

import { memo, useState } from 'react';
import clsx from 'clsx';
import { Flag, X, Check } from 'lucide-react';

const REPORT_CATEGORIES = [
  { id: 'threats', label: 'Threats or violence', severity: 'high' },
  { id: 'harassment', label: 'Harassment or bullying', severity: 'high' },
  { id: 'misinfo', label: 'Misinformation / misleading', severity: 'medium' },
  { id: 'hate', label: 'Hate speech or extremism', severity: 'high' },
  { id: 'spam', label: 'Spam or manipulation', severity: 'medium' },
  { id: 'impersonation', label: 'Impersonation', severity: 'medium' },
  { id: 'other', label: 'Other', severity: 'low' },
];

/**
 * Inline content report panel. Wrapped in memo() — depends only on postId +
 * onClose, so it does not re-render when sibling reaction state changes.
 * Report submission flow is preserved verbatim (local optimistic confirm).
 */
export const InlineReportPanel = memo(function InlineReportPanel({
  onClose,
}: {
  // postId is part of the public contract (callers pass it and the submission
  // flow will use it once the report API is wired); the local optimistic-confirm
  // body does not reference it yet.
  postId: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-3 p-4 bg-surface border border-border-subtle rounded-xl animate-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-positive/10 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-positive-light" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Report submitted</p>
            <p className="text-xs text-text-muted">Our moderation team will review within 24 hours.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-surface border border-border-subtle rounded-xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-danger-light" aria-hidden="true" />
          <span className="text-xs font-semibold text-text-primary">Report content</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close report panel"
          className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4 space-y-1.5">
        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(cat.id);
            }}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs transition-colors min-h-[44px]',
              selected === cat.id
                ? 'bg-civic-muted border border-civic/30 text-text-primary'
                : 'bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover',
            )}
          >
            <div
              className={clsx(
                'w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0',
                selected === cat.id ? 'bg-civic border-civic' : 'border-border-strong',
              )}
            >
              {selected === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-bg" />}
            </div>
            {cat.label}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (selected) setSubmitted(true);
          }}
          disabled={!selected}
          className={clsx(
            'w-full mt-2 py-2.5 rounded-xl text-xs font-semibold transition-colors min-h-[44px]',
            selected ? 'bg-danger text-white hover:bg-danger/80' : 'bg-surface-active text-text-muted cursor-not-allowed',
          )}
        >
          Submit report
        </button>
      </div>
    </div>
  );
});
