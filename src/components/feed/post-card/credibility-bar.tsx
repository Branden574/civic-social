'use client';

import { memo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ShieldCheck, ExternalLink } from 'lucide-react';
import type { PostSource, PostThread } from './types';

// ─── Credibility scoring (0–100, mirrors prototype credColor thresholds) ──
// 85+ green / 60–84 amber / <60 red.

export function credLabel(score: number): string {
  return score >= 85 ? 'High credibility' : score >= 60 ? 'Mixed sources' : 'Low credibility';
}

/** Tailwind text color class keyed by threshold. */
function credColorClass(score: number): string {
  return score >= 85 ? 'text-positive-light' : score >= 60 ? 'text-warning-light' : 'text-danger-light';
}

/** Inline bar fill color keyed by threshold (matches text color tokens). */
function credBarColor(score: number): string {
  return score >= 85
    ? 'var(--color-positive-light)'
    : score >= 60
      ? 'var(--color-warning-light)'
      : 'var(--color-danger-light)';
}

/**
 * Compact credibility meter shown directly under post body, per prototype.
 * A thin trust bar with a JetBrains Mono score + source count that expands
 * to a per-source breakdown and thread health stats.
 *
 * `score` is a 0–100 integer derived by the parent from the post algorithm.
 */
export const CredibilityBar = memo(function CredibilityBar({
  score,
  sources,
  thread,
  open,
  onToggle,
}: {
  score: number;
  sources: PostSource[];
  thread: PostThread | null;
  open: boolean;
  onToggle: () => void;
}) {
  const colorClass = credColorClass(score);
  const barColor = credBarColor(score);
  const sourceCount = sources.length;
  const countLabel = sourceCount > 0 ? `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}` : '';

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={open}
        aria-label={`Credibility ${score} of 100 — ${credLabel(score)}. ${open ? 'Hide' : 'Show'} sources.`}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 bg-transparent border border-border-subtle rounded-[10px] hover:bg-surface-hover transition-colors duration-150 text-left min-h-[44px]"
      >
        <ShieldCheck className={clsx('w-3.5 h-3.5 shrink-0', colorClass)} aria-hidden="true" />
        <span className={clsx('text-[11.5px] font-bold whitespace-nowrap', colorClass)}>{credLabel(score)}</span>
        <span className="flex-1 h-[3px] rounded-full bg-surface-active overflow-hidden">
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{ width: `${score}%`, background: barColor }}
          />
        </span>
        <span className={clsx('text-[11px] font-semibold font-mono', colorClass)}>{score}</span>
        {countLabel && <span className="text-[11px] text-text-muted whitespace-nowrap">{countLabel}</span>}
        <ChevronDown
          className="w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-[7px] p-3 bg-surface border border-border-subtle rounded-xl animate-fade-in">
          {sources.length > 0 ? (
            sources.map((src, i) => {
              const srcScore = Math.round(src.trustScore * 100);
              const isPrimary = src.trustScore >= 0.9;
              return (
                <div key={i} className="flex items-center gap-2.5 py-1">
                  <ExternalLink className="w-3 h-3 text-text-muted shrink-0" aria-hidden="true" />
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 truncate text-[12.5px] text-text-secondary underline decoration-border hover:decoration-text-secondary"
                  >
                    {src.domain}
                  </a>
                  {isPrimary && (
                    <span className="text-[9.5px] font-bold tracking-[0.05em] px-[7px] py-0.5 rounded-full bg-civic-subtle text-civic-light whitespace-nowrap">
                      PRIMARY SOURCE
                    </span>
                  )}
                  <span className="w-16 h-[3px] rounded-full bg-surface-active overflow-hidden shrink-0">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${srcScore}%`, background: credBarColor(srcScore) }}
                    />
                  </span>
                  <span
                    className={clsx('w-[30px] text-right text-[11px] font-semibold font-mono', credColorClass(srcScore))}
                  >
                    {srcScore}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-[12px] text-text-muted py-1">No external sources cited.</p>
          )}

          {thread && (
            <div className="flex items-center gap-3.5 mt-2 pt-[9px] border-t border-border-subtle text-[11.5px] text-text-muted flex-wrap">
              <span>{thread.participantCount} participants</span>
              <span>
                Civility{' '}
                <span
                  className={clsx(
                    'font-semibold',
                    thread.civilityScore >= 0.7
                      ? 'text-positive-light'
                      : thread.civilityScore >= 0.4
                        ? 'text-warning-light'
                        : 'text-danger-light',
                  )}
                >
                  {Math.round(thread.civilityScore * 100)}%
                </span>
              </span>
              <span>
                Viewpoint diversity{' '}
                <span className="font-semibold text-text-secondary">{Math.round(thread.diversityScore * 100)}%</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
