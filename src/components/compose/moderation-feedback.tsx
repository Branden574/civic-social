'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — Compose Moderation Feedback
// ═══════════════════════════════════════════════════════════════
// Presentational pieces for the compose "civility coach":
//   • ToneIndicator     — live dot+label pill (Civil / Caution / Heated)
//   • CoachPanel        — friendly writing-coach suggestions (max 3)
//   • BlockedPanel      — firm in-modal blocked state (server 422)
//   • HeldConfirmation  — post sent to moderator review (held=true)
//   • NudgeConfirmation — posted, with one improvement tip
// Tone: helpful writing assistant — never preachy.
// ═══════════════════════════════════════════════════════════════

import {
  Lightbulb,
  Link2,
  MessageCircle,
  Sparkles,
  ShieldAlert,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import type { ModerationResult } from '@/lib/moderation/types';

// ─── Tone mapping ─────────────────────────────────────────────

export type ToneLevel = 'empty' | 'civil' | 'caution' | 'heated';

export function toneFromResult(result: ModerationResult, isEmpty: boolean): ToneLevel {
  if (isEmpty) return 'empty';
  if (
    result.action === 'block' ||
    result.action === 'hold_for_review' ||
    result.severity === 'critical' ||
    result.severity === 'high' ||
    result.score < 0.5
  ) {
    return 'heated';
  }
  if (
    result.action === 'nudge' ||
    result.severity === 'medium' ||
    result.issues.length > 0 ||
    result.score < 0.8
  ) {
    return 'caution';
  }
  return 'civil';
}

const TONE_STYLES: Record<ToneLevel, { label: string; pill: string; dot: string; pulse: boolean }> = {
  empty: {
    label: 'Tone preview',
    pill: 'bg-surface-elevated text-text-muted',
    dot: 'bg-text-muted',
    pulse: false,
  },
  civil: {
    label: 'Civil tone',
    pill: 'bg-positive/10 text-positive-light',
    dot: 'bg-positive-light',
    pulse: false,
  },
  caution: {
    label: 'Caution — strong tone',
    pill: 'bg-warning/10 text-warning-light',
    dot: 'bg-warning-light',
    pulse: false,
  },
  heated: {
    label: 'Heated — consider revising',
    pill: 'bg-danger/10 text-danger-light',
    dot: 'bg-danger-light',
    pulse: true,
  },
};

/** Live dot + label pill, per prototype compose header. */
export function ToneIndicator({ tone }: { tone: ToneLevel }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      role="status"
      aria-live="polite"
      className={clsx(
        'flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors',
        s.pill,
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', s.dot, s.pulse && 'animate-pulse-dot')} />
      {s.label}
    </span>
  );
}

// ─── Coach panel ──────────────────────────────────────────────

function SuggestionIcon({ text }: { text: string }) {
  const cls = 'w-3.5 h-3.5 shrink-0 mt-0.5 text-civic-light';
  if (/source|evidence|link/i.test(text)) return <Link2 className={cls} aria-hidden />;
  if (/person|policy|group|repl/i.test(text)) return <MessageCircle className={cls} aria-hidden />;
  return <Lightbulb className={cls} aria-hidden />;
}

/** Friendly coaching panel — lists up to 3 suggestions from moderateLocal. */
export function CoachPanel({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="animate-fade-in p-3 rounded-xl bg-surface-elevated/60 border border-border-subtle">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-civic-light" aria-hidden />
        <span className="text-[11px] font-semibold tracking-wide text-civic-light">Writing coach</span>
      </div>
      <ul className="space-y-1.5">
        {suggestions.slice(0, 3).map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
            <SuggestionIcon text={s} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Blocked state (server 422) ───────────────────────────────

/** Firm, clear in-modal blocked state. Draft stays — submit re-enables on edit. */
export function BlockedPanel({
  message,
  issues,
  suggestions,
}: {
  message: string | null;
  issues: string[];
  suggestions: string[];
}) {
  return (
    <div role="alert" className="animate-fade-in p-3.5 rounded-xl bg-danger/10 border border-danger/30">
      <div className="flex items-center gap-2 mb-1.5">
        <ShieldAlert className="w-4 h-4 text-danger-light shrink-0" aria-hidden />
        <span className="text-[13px] font-bold text-danger-light">This post can&apos;t be published</span>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        {message || 'It conflicts with our community guidelines.'}
      </p>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
              <span className="text-danger-light mt-px" aria-hidden>•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {suggestions.slice(0, 3).map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
              <SuggestionIcon text={s} />
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-text-muted">
        Your draft is saved — edit it and try again.
      </p>
    </div>
  );
}

// ─── Held-for-review confirmation ─────────────────────────────

/** Confirmation state when the server held the post for human review. */
export function HeldConfirmation({ message, onDone }: { message: string | null; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-civic-muted flex items-center justify-center mb-4">
        <Clock3 className="w-6 h-6 text-civic-light" aria-hidden />
      </div>
      <h3 className="text-[15px] font-bold text-text-primary mb-1.5">Sent for a quick review</h3>
      <p className="text-[13px] leading-relaxed text-text-secondary max-w-[380px]">
        {message ||
          'Your post was sent to a moderator before publishing. You’ll be notified as soon as it’s reviewed.'}
      </p>
      <p className="mt-2 text-xs text-text-muted max-w-[380px]">
        It won&apos;t appear in the public feed until it&apos;s approved.
      </p>
      <button
        onClick={onDone}
        className="mt-6 px-[22px] py-2.5 rounded-full bg-civic text-[#16130d] text-sm font-bold hover:brightness-110 transition-[filter] min-h-[44px]"
      >
        Done
      </button>
    </div>
  );
}

// ─── Nudge confirmation (posted + tip) ────────────────────────

/** Post went through — show the server's improvement tip briefly. */
export function NudgeConfirmation({ message }: { message: string | null }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10 animate-fade-in" role="status" aria-live="polite">
      <div className="w-12 h-12 rounded-full bg-positive/10 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-6 h-6 text-positive-light" aria-hidden />
      </div>
      <h3 className="text-[15px] font-bold text-text-primary mb-1.5">Posted</h3>
      {message && (
        <p className="text-[13px] leading-relaxed text-text-secondary max-w-[380px]">
          <Sparkles className="w-3.5 h-3.5 text-civic-light inline mr-1.5 -mt-0.5" aria-hidden />
          {message}
        </p>
      )}
    </div>
  );
}
