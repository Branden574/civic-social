'use client';

import { ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

/**
 * Blue-green badge shown for users with credibility_score >= 90.
 * Displays inline next to the user's name.
 *
 * Props:
 *  - score: number (0-100)
 *  - size: 'sm' | 'md' (default 'sm')
 *  - showLabel: boolean (default false) — shows "90+" text
 */
export function CredibilityBadge({
  score,
  size = 'sm',
  showLabel = false,
}: {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  if (score < 90) return null;

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 shrink-0',
        showLabel && 'bg-[#0d9488]/10 px-1.5 py-0.5 rounded-full',
      )}
      title={`Credibility: ${score}% — Earned through civil, sourced participation.`}
      role="img"
      aria-label={`Credibility score ${score}%`}
    >
      <ShieldCheck
        className={clsx(
          iconSize,
          'text-[#0d9488]', // blue-green (teal-600)
        )}
      />
      {showLabel && (
        <span className="text-[10px] font-semibold text-[#0d9488]">
          {score}%
        </span>
      )}
    </span>
  );
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
