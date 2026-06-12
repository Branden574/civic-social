'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ThumbsUp, ThumbsDown, X, Check } from 'lucide-react';
import type { ReactionType } from './types';

const FEEDBACK_REASONS: Record<string, { id: string; label: string }[]> = {
  agree: [
    { id: 'well-sourced', label: 'Well-sourced & cited' },
    { id: 'solution-oriented', label: 'Solution-oriented thinking' },
    { id: 'changed-perspective', label: 'Changed my perspective' },
    { id: 'fair-to-all', label: 'Fair to all sides' },
    { id: 'expert-analysis', label: 'Expert-level analysis' },
    { id: 'strong-evidence', label: 'Strong evidence presented' },
  ],
  disagree: [
    { id: 'missing-sources', label: 'Missing credible sources' },
    { id: 'misleading-claims', label: 'Contains misleading claims' },
    { id: 'ignores-counter', label: 'Ignores counter-arguments' },
    { id: 'one-sided', label: 'One-sided perspective' },
    { id: 'inflammatory', label: 'Inflammatory language' },
    { id: 'logical-fallacy', label: 'Logical fallacy' },
  ],
};

/**
 * Portal bottom-sheet that asks WHY a user agreed / disagreed. Submission flow
 * preserved verbatim — the parent owns the network call via onSubmit.
 */
export function FeedbackModal({
  reactionType,
  onSubmit,
  onSkip,
}: {
  reactionType: ReactionType;
  onSubmit: (reasons: string[]) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const reasons = FEEDBACK_REASONS[reactionType] || FEEDBACK_REASONS.agree;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setSubmitted(true);
    onSubmit(Array.from(selected));
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const isAgree = reactionType === 'agree';
  const title = isAgree ? 'Why do you agree?' : 'Why do you disagree?';
  const Icon = isAgree ? ThumbsUp : ThumbsDown;
  const color = isAgree ? 'text-positive-light' : 'text-danger-light';

  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onSkip} />
        <div className="relative bg-bg-alt border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 pb-safe text-center animate-slide-up">
          <div className="w-12 h-12 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-positive-light" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-text-primary mb-1">Thanks for your feedback!</p>
          <p className="text-sm text-text-muted mb-4">Your input helps improve content ranking for everyone.</p>
          <button
            type="button"
            onClick={onSkip}
            className="px-6 py-3 bg-civic text-text-inverse text-sm font-semibold rounded-xl hover:brightness-110 transition-[filter] min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onSkip} />
      <div className="relative bg-bg-alt border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md animate-slide-up shadow-lg">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Icon className={clsx('w-5 h-5', color)} aria-hidden="true" />
            <span className={clsx('text-sm font-semibold', color)}>{title}</span>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close feedback"
            className="p-2 -mr-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-surface-active" />
        </div>

        <div className="px-5 pb-5 space-y-2">
          {reasons.map((reason) => {
            const isSelected = selected.has(reason.id);
            return (
              <button
                key={reason.id}
                type="button"
                onClick={() => toggle(reason.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-colors min-h-[48px]',
                  isSelected
                    ? 'bg-civic-muted border border-civic/30 text-text-primary font-medium'
                    : 'bg-surface-elevated border border-border-subtle text-text-secondary hover:bg-surface-hover',
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-civic border-civic text-text-inverse' : 'border-border-strong',
                  )}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                </div>
                <span>{reason.label}</span>
              </button>
            );
          })}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors min-h-[44px]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selected.size === 0}
              className={clsx(
                'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px]',
                selected.size > 0
                  ? 'bg-civic text-text-inverse hover:brightness-110'
                  : 'bg-surface-active text-text-muted cursor-not-allowed',
              )}
            >
              Submit ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
