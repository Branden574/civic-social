'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Scale,
  Send,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Shield,
} from 'lucide-react';
import clsx from 'clsx';
import { moderateLocal } from '@/lib/moderation/analyzer';

// ─── Types ───────────────────────────────────────────────────

interface DebateComposerProps {
  isOpen: boolean;
  onClose: () => void;
  debateTitle?: string;
}

interface CivilityResult {
  level: 'green' | 'yellow' | 'red';
  label: string;
}

// ─── Civility (shared moderation engine) ─────────────────────
// Uses the same analyzer as compose + the posts API, so debate
// composers see the same verdicts the server will enforce.
// (Previously this file had its own divergent word-list heuristic.)

function analyzeCivility(text: string): CivilityResult {
  if (!text || text.length < 5) return { level: 'green', label: 'Civil' };

  const r = moderateLocal(text);
  if (r.action === 'block') return { level: 'red', label: 'Not allowed' };
  if (r.severity === 'medium' || r.score < 0.45) return { level: 'red', label: 'Hostile' };
  if (r.score < 0.65 || r.severity === 'low') return { level: 'yellow', label: 'Caution' };
  return { level: 'green', label: 'Civil' };
}

const CIVILITY_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  green: { dot: 'bg-positive', text: 'text-positive-light', bg: 'bg-positive/10' },
  yellow: { dot: 'bg-warning', text: 'text-warning-light', bg: 'bg-warning/10' },
  red: { dot: 'bg-danger', text: 'text-danger-light', bg: 'bg-danger/10' },
};

// ─── Cooldown ────────────────────────────────────────────────

const COOLDOWN_SECONDS = 30;

// ─── Component ───────────────────────────────────────────────

export function DebateComposer({ isOpen, onClose, debateTitle }: DebateComposerProps) {
  // ── Field state ──
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [reasoning, setReasoning] = useState('');

  // ── Steelman ──
  const [steelmanEnabled, setSteelmanEnabled] = useState(false);
  const [steelmanText, setSteelmanText] = useState('');

  // ── UI state ──
  const [posting, setPosting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Combine all text for civility check ──
  const allText = [claim, evidence, reasoning, steelmanText].join(' ');
  const civility = analyzeCivility(allText);
  const civilityStyle = CIVILITY_STYLES[civility.level];

  // ── Auto-resize textareas ──
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, []);

  // ── Cooldown timer ──
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  // ── Validation ──
  const isValid = claim.trim().length > 0 && evidence.trim().length > 0 && reasoning.trim().length > 0;

  // ── Submit handler ──
  const handleSubmit = useCallback(async () => {
    if (!isValid || posting || cooldown > 0) return;

    setPosting(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    setPosting(false);

    // Start cooldown
    setCooldown(COOLDOWN_SECONDS);

    // Reset fields
    setClaim('');
    setEvidence('');
    setEvidenceUrl('');
    setReasoning('');
    setSteelmanText('');
    setSteelmanEnabled(false);
    onClose();
  }, [isValid, posting, cooldown, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl bg-bg-alt sm:rounded-2xl border border-border-subtle max-h-[90vh] overflow-hidden flex flex-col animate-slide-up rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-center flex-1">
            <p className="text-sm font-semibold text-text-primary">
              Structured Response
            </p>
            {debateTitle && (
              <p className="text-xs text-text-muted truncate max-w-xs mx-auto">
                {debateTitle}
              </p>
            )}
          </div>
          {/* Civility indicator */}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold',
              civilityStyle.bg,
              civilityStyle.text,
            )}
          >
            <span className={clsx('w-2 h-2 rounded-full', civilityStyle.dot)} />
            {civility.label}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cooldown notice */}
          {cooldown > 0 && (
            <div className="flex items-center gap-3 p-3 bg-warning/5 border border-warning/20 rounded-xl animate-fade-in">
              <Clock className="w-4 h-4 text-warning-light shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-warning-light">
                  Take a moment
                </p>
                <p className="text-xs text-text-muted">
                  Heated discussions benefit from a pause
                </p>
              </div>
              <span className="text-sm font-mono font-bold text-warning-light">
                {cooldown}s
              </span>
            </div>
          )}

          {/* ── 1. CLAIM ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-civic-subtle flex items-center justify-center text-xs font-bold text-civic-light">
                  1
                </span>
                <span className="text-xs font-semibold text-text-primary">
                  Claim
                </span>
                <span className="text-xs text-danger-light">*</span>
              </label>
              <span
                className={clsx(
                  'text-xs font-mono',
                  claim.length > 450 ? 'text-danger-light' : 'text-text-muted',
                )}
              >
                {claim.length}/500
              </span>
            </div>
            <p className="text-xs text-text-muted mb-2">
              State your main argument clearly and concisely.
            </p>
            <textarea
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                autoResize(e.target);
              }}
              placeholder="What is your core argument? Be specific and direct..."
              maxLength={500}
              className="w-full bg-surface rounded-xl border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-civic/40 transition-colors min-h-[80px]"
            />
          </div>

          {/* ── 2. EVIDENCE ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-civic-subtle flex items-center justify-center text-xs font-bold text-civic-light">
                  2
                </span>
                <span className="text-xs font-semibold text-text-primary">
                  Evidence
                </span>
                <span className="text-xs text-danger-light">*</span>
              </label>
              <span
                className={clsx(
                  'text-xs font-mono',
                  evidence.length > 900 ? 'text-danger-light' : 'text-text-muted',
                )}
              >
                {evidence.length}/1000
              </span>
            </div>
            <p className="text-xs text-text-muted mb-2">
              Provide data, statistics, or sources that support your claim.
            </p>
            <textarea
              value={evidence}
              onChange={(e) => {
                setEvidence(e.target.value);
                autoResize(e.target);
              }}
              placeholder="What data, research, or examples support your position?"
              maxLength={1000}
              className="w-full bg-surface rounded-xl border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-civic/40 transition-colors min-h-[80px]"
            />
            {/* Source URL input */}
            <div className="flex items-center gap-2 mt-2 p-2.5 bg-surface rounded-xl border border-border-subtle">
              <Link2 className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="Paste source URL (optional)..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {evidenceUrl && (
                <button
                  onClick={() => setEvidenceUrl('')}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── 3. REASONING ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-civic-subtle flex items-center justify-center text-xs font-bold text-civic-light">
                  3
                </span>
                <span className="text-xs font-semibold text-text-primary">
                  Reasoning
                </span>
                <span className="text-xs text-danger-light">*</span>
              </label>
              <span
                className={clsx(
                  'text-xs font-mono',
                  reasoning.length > 900 ? 'text-danger-light' : 'text-text-muted',
                )}
              >
                {reasoning.length}/1000
              </span>
            </div>
            <p className="text-xs text-text-muted mb-2">
              Explain how your evidence supports your claim. Connect the dots.
            </p>
            <textarea
              value={reasoning}
              onChange={(e) => {
                setReasoning(e.target.value);
                autoResize(e.target);
              }}
              placeholder="How does your evidence support your claim? What's the logical connection?"
              maxLength={1000}
              className="w-full bg-surface rounded-xl border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-civic/40 transition-colors min-h-[80px]"
            />
          </div>

          {/* ── Steelman Toggle ── */}
          <div className="rounded-xl border border-border-subtle bg-surface-elevated overflow-hidden">
            <button
              onClick={() => setSteelmanEnabled(!steelmanEnabled)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
            >
              <Scale className="w-4 h-4 text-civic-light shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-primary">
                  Steelman their position first
                </p>
                <p className="text-xs text-text-muted">
                  Demonstrating you understand the opposing view earns credibility
                </p>
              </div>
              <div
                className={clsx(
                  'w-9 h-5 rounded-full transition-colors relative shrink-0',
                  steelmanEnabled ? 'bg-civic' : 'bg-surface-active',
                )}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-colors duration-200"
                  style={{ left: steelmanEnabled ? '18px' : '3px' }}
                />
              </div>
            </button>

            {steelmanEnabled && (
              <div className="px-4 pb-4 pt-1 border-t border-border-subtle animate-fade-in">
                <textarea
                  value={steelmanText}
                  onChange={(e) => {
                    setSteelmanText(e.target.value);
                    autoResize(e.target);
                  }}
                  placeholder="Before responding, summarize your opponent's strongest argument..."
                  maxLength={500}
                  className="w-full bg-surface rounded-xl border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-civic/40 transition-colors min-h-[60px]"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Steelmanning boosts your credibility score
                  </p>
                  <span className="text-xs font-mono text-text-muted">
                    {steelmanText.length}/500
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Civility Warning ── */}
          {civility.level !== 'green' && allText.length > 20 && (
            <div
              className={clsx(
                'flex items-start gap-2.5 p-3 rounded-xl border animate-fade-in',
                civility.level === 'yellow'
                  ? 'bg-warning/5 border-warning/20'
                  : 'bg-danger/5 border-danger/20',
              )}
            >
              <AlertTriangle
                className={clsx(
                  'w-4 h-4 shrink-0 mt-0.5',
                  civility.level === 'yellow' ? 'text-warning-light' : 'text-danger-light',
                )}
              />
              <div>
                <p
                  className={clsx(
                    'text-xs font-semibold',
                    civility.level === 'yellow' ? 'text-warning-light' : 'text-danger-light',
                  )}
                >
                  {civility.level === 'yellow'
                    ? 'Tone may be confrontational'
                    : 'Hostile language detected'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Structured debates reward clarity and respect. Consider rephrasing for maximum impact.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {/* Civility dot */}
            <div className="flex items-center gap-1.5">
              <span className={clsx('w-2 h-2 rounded-full', civilityStyle.dot)} />
              <span className={clsx('text-xs font-semibold', civilityStyle.text)}>
                {civility.label}
              </span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || posting || cooldown > 0}
              className={clsx(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
                isValid && !posting && cooldown === 0
                  ? 'bg-civic text-white hover:bg-civic-dark'
                  : 'bg-surface-active text-text-muted cursor-not-allowed',
              )}
            >
              {posting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : cooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  {cooldown}s
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Post Structured Response
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
