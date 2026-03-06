'use client';

import { ShieldCheck, Award } from 'lucide-react';
import clsx from 'clsx';

/**
 * Credibility badge with tiered display:
 *  - score < 90: no badge shown (still shown if showAlways=true)
 *  - 90–94: green badge (ShieldCheck)
 *  - 95+: gold badge (Award)
 *
 * Props:
 *  - score: number (0-100)
 *  - size: 'sm' | 'md' (default 'sm')
 *  - showLabel: boolean (default false) — shows percentage text
 *  - showAlways: boolean (default false) — show score even below 90
 */
export function CredibilityBadge({
  score,
  size = 'sm',
  showLabel = false,
  showAlways = false,
}: {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  showAlways?: boolean;
}) {
  if (score < 90 && !showAlways) return null;

  const isGold = score >= 95;
  const isGreen = score >= 90;
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  // Gold tier: 95%+
  if (isGold) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 shrink-0',
          showLabel && 'bg-amber-500/10 px-1.5 py-0.5 rounded-full',
        )}
        title={`Credibility: ${score}% — Gold tier. Earned through exceptional civil, sourced participation.`}
        role="img"
        aria-label={`Gold credibility score ${score}%`}
      >
        <Award className={clsx(iconSize, 'text-amber-500')} />
        {showLabel && (
          <span className="text-[10px] font-semibold text-amber-500">
            {score}%
          </span>
        )}
      </span>
    );
  }

  // Green tier: 90-94%
  if (isGreen) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 shrink-0',
          showLabel && 'bg-emerald-500/10 px-1.5 py-0.5 rounded-full',
        )}
        title={`Credibility: ${score}% — Earned through civil, sourced participation.`}
        role="img"
        aria-label={`Credibility score ${score}%`}
      >
        <ShieldCheck className={clsx(iconSize, 'text-emerald-500')} />
        {showLabel && (
          <span className="text-[10px] font-semibold text-emerald-500">
            {score}%
          </span>
        )}
      </span>
    );
  }

  // Below 90 (only visible with showAlways)
  if (showAlways) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-0.5 shrink-0',
          showLabel && 'bg-surface-active px-1.5 py-0.5 rounded-full',
        )}
        title={`Credibility: ${score}%`}
        role="img"
        aria-label={`Credibility score ${score}%`}
      >
        {showLabel && (
          <span className="text-[10px] font-semibold text-text-muted">
            {score}%
          </span>
        )}
      </span>
    );
  }

  return null;
}

/**
 * Verification badge (separate from credibility).
 * Standard platform verification.
 */
export function VerifiedBadge({
  level,
  size = 'sm',
}: {
  level: string;
  size?: 'sm' | 'md';
}) {
  const isVerified =
    level === 'EXPERT_VERIFIED' ||
    level === 'OFFICIAL_VERIFIED' ||
    level === 'CITIZEN_VERIFIED';

  if (!isVerified) return null;

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  const labelMap: Record<string, { label: string; color: string }> = {
    EXPERT_VERIFIED: { label: 'Verified Expert', color: 'text-positive' },
    OFFICIAL_VERIFIED: { label: 'Verified Official', color: 'text-warning' },
    CITIZEN_VERIFIED: { label: 'Verified Citizen', color: 'text-info' },
  };

  const meta = labelMap[level];
  if (!meta) return null;

  return (
    <span
      className="inline-flex items-center shrink-0"
      title={meta.label}
      role="img"
      aria-label={meta.label}
    >
      <ShieldCheck className={clsx(iconSize, meta.color)} />
    </span>
  );
}
