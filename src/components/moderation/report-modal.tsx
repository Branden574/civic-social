'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Flag,
  AlertTriangle,
  Shield,
  Send,
  CheckCircle2,
  Info,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postSnippet: string;
}

interface ReportCategory {
  id: string;
  label: string;
  description: string;
  severity: 'red' | 'orange' | 'yellow';
}

// ─── Report Categories ───────────────────────────────────────

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'threats',
    label: 'Threats or violence',
    description: 'Direct or implied threats of physical harm',
    severity: 'red',
  },
  {
    id: 'harassment',
    label: 'Harassment or bullying',
    description: 'Targeted, repeated, or severe abuse toward an individual',
    severity: 'orange',
  },
  {
    id: 'misinformation',
    label: 'Misinformation / misleading claims',
    description: 'Verifiably false or deliberately deceptive content',
    severity: 'yellow',
  },
  {
    id: 'hate-speech',
    label: 'Hate speech or extremism',
    description: 'Content promoting hatred against protected groups',
    severity: 'red',
  },
  {
    id: 'spam',
    label: 'Spam or manipulation',
    description: 'Coordinated inauthentic behavior, bot activity, or spam',
    severity: 'yellow',
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    description: 'Pretending to be another person or organization',
    severity: 'orange',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else not listed above',
    severity: 'yellow',
  },
];

const SEVERITY_STYLES: Record<string, { dot: string; label: string; bg: string; text: string; border: string }> = {
  red: {
    dot: 'bg-danger',
    label: 'High Severity',
    bg: 'bg-danger/5',
    text: 'text-danger-light',
    border: 'border-danger/20',
  },
  orange: {
    dot: 'bg-warning',
    label: 'Medium Severity',
    bg: 'bg-warning/5',
    text: 'text-warning-light',
    border: 'border-warning/20',
  },
  yellow: {
    dot: 'bg-[#EAB308]',
    label: 'Standard Review',
    bg: 'bg-[#EAB308]/5',
    text: 'text-[#EAB308]',
    border: 'border-[#EAB308]/20',
  },
};

// ─── Component ───────────────────────────────────────────────

export function ReportModal({ isOpen, onClose, postId, postSnippet }: ReportModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const category = REPORT_CATEGORIES.find((c) => c.id === selectedCategory);
  const severity = category ? SEVERITY_STYLES[category.severity] : null;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!selectedCategory || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          category: selectedCategory,
          details: details || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  }, [selectedCategory, submitting, postId, details]);

  const handleClose = useCallback(() => {
    // Reset state on close
    setSelectedCategory(null);
    setDetails('');
    setSubmitting(false);
    setSubmitted(false);
    setSubmitError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-bg-alt sm:rounded-2xl border border-border-subtle max-h-[90vh] overflow-hidden flex flex-col animate-slide-up rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-danger-light" />
            <span className="text-sm font-semibold text-text-primary">
              Report Content
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {!submitted ? (
            <>
              {/* Post snippet */}
              <div className="mb-4 p-3 bg-surface rounded-xl border border-border-subtle">
                <p className="text-xs font-semibold text-text-muted mb-1">
                  Reported Content
                </p>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                  &ldquo;{postSnippet}&rdquo;
                </p>
                <p className="text-xs text-text-muted mt-1 font-mono">
                  Post ID: {postId}
                </p>
              </div>

              {/* Severity indicator */}
              {severity && (
                <div
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border mb-4 animate-fade-in',
                    severity.bg,
                    severity.border,
                  )}
                >
                  <span className={clsx('w-2.5 h-2.5 rounded-full', severity.dot)} />
                  <span className={clsx('text-xs font-semibold', severity.text)}>
                    {severity.label}
                  </span>
                  <span className="text-xs text-text-muted ml-1">
                    — {category?.description}
                  </span>
                </div>
              )}

              {/* Report categories */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-text-muted mb-2.5">
                  What&apos;s the issue?
                </h3>
                <div className="space-y-1.5">
                  {REPORT_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const catSeverity = SEVERITY_STYLES[cat.severity];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                          isSelected
                            ? 'bg-civic-subtle border border-civic/30'
                            : 'bg-surface border border-border-subtle hover:bg-surface-hover',
                        )}
                      >
                        {/* Radio circle */}
                        <div
                          className={clsx(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'border-civic bg-civic'
                              : 'border-border-strong',
                          )}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className={clsx(
                              'text-xs font-medium',
                              isSelected ? 'text-text-primary' : 'text-text-secondary',
                            )}
                          >
                            {cat.label}
                          </p>
                        </div>

                        {/* Severity dot */}
                        <span
                          className={clsx(
                            'w-2 h-2 rounded-full shrink-0',
                            catSeverity.dot,
                          )}
                          title={catSeverity.label}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional details */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-text-muted mb-1.5 block">
                  Additional Details{' '}
                  <span className="text-text-muted font-normal normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional context that may help our review team..."
                  maxLength={1000}
                  className="w-full bg-surface rounded-xl border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-civic/40 transition-colors min-h-[80px]"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-mono text-text-muted">
                    {details.length}/1000
                  </span>
                </div>
              </div>

              {/* Error message */}
              {submitError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border mb-4 bg-danger/5 border-danger/20 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-danger-light shrink-0" />
                  <p className="text-xs text-danger-light">{submitError}</p>
                </div>
              )}

              {/* Credibility note */}
              <div className="flex items-start gap-2 p-3 bg-surface rounded-xl border border-border-subtle mb-4">
                <Info className="w-4 h-4 text-civic-light shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted leading-relaxed">
                  Your report credibility score affects review priority. Accurate reports
                  improve your score; false reports may reduce it.
                </p>
              </div>
            </>
          ) : (
            /* ── Success State ── */
            <div className="py-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-positive-light" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1.5">
                Report Submitted
              </h3>
              <p className="text-sm text-text-secondary max-w-xs mx-auto leading-relaxed">
                Our moderation team will review within 24 hours. You&apos;ll be notified
                of the outcome.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-surface-elevated rounded-xl border border-border-subtle">
                <Shield className="w-3.5 h-3.5 text-civic-light" />
                <span className="text-xs text-text-muted">
                  Report #{postId.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted ? (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedCategory || submitting}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
                selectedCategory && !submitting
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'bg-surface-active text-text-muted cursor-not-allowed',
              )}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border-subtle">
            <button
              onClick={handleClose}
              className="w-full py-2 text-sm font-semibold text-civic-light bg-civic-subtle hover:bg-civic-muted rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
