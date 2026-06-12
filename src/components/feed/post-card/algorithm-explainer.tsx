'use client';

import { memo, useMemo } from 'react';
import clsx from 'clsx';
import { Info, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { analyzeCivility } from '@/lib/civility';
import type { PostAlgorithm } from './types';

// ─── "Why am I seeing this?" — restyled per prototype signal list ──────

function SignalRow({ label, value, weight, isNegative }: { label: string; value: number; weight: string; isNegative?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 py-[2.5px]">
      <span className="w-[124px] shrink-0 truncate text-[11px] text-text-muted whitespace-nowrap">{label}</span>
      <span className="flex-1 h-1 rounded-full bg-surface-active overflow-hidden">
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: isNegative ? 'var(--color-danger-light)' : 'var(--color-civic)',
          }}
        />
      </span>
      <span
        className={clsx(
          'w-[30px] text-right text-[10.5px] font-mono',
          isNegative ? 'text-danger-light' : 'text-text-secondary',
        )}
      >
        {isNegative ? '-' : ''}
        {pct}%
      </span>
      <span className="w-7 text-right text-[9.5px] text-text-muted whitespace-nowrap">{weight}</span>
    </div>
  );
}

/**
 * Algorithm transparency panel. Wrapped in memo() — only re-renders when the
 * algorithm payload or post content changes (not on parent reaction state).
 * The civility analysis is memoized on `postContent` so the moderation engine
 * runs at most once per distinct body.
 */
export const AlgorithmExplainer = memo(function AlgorithmExplainer({
  algorithm,
  postContent,
}: {
  algorithm: PostAlgorithm;
  postContent: string;
}) {
  const signals = algorithm.signals;
  const civility = useMemo(() => analyzeCivility(postContent), [postContent]);
  const qualityScore = Math.round((algorithm.qualityScore ?? 0) * 100);

  return (
    <div className="mt-[7px] p-[13px] bg-surface border border-border-subtle rounded-xl animate-fade-in">
      <div className="flex items-center gap-[7px] mb-1.5">
        <Info className="w-3.5 h-3.5 text-civic-light shrink-0" aria-hidden="true" />
        <h4 className="flex-1 text-[12px] font-bold text-text-primary">Why you&apos;re seeing this</h4>
        <span className="text-[10.5px] font-semibold font-mono px-2 py-0.5 rounded-full bg-civic-subtle text-civic-light">
          Quality {qualityScore}
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.55] text-text-secondary mb-2.5">{algorithm.explanation}</p>

      <div>
        <SignalRow label="Civility history" value={signals.civility} weight="×1.2" />
        <SignalRow label="Engagement quality" value={signals.engagementQuality} weight="×1.0" />
        <SignalRow label="Viewpoint diversity" value={signals.viewpointDiversity} weight="×1.4" />
        <SignalRow label="Source credibility" value={signals.sourceCredibility} weight="×1.5" />
        <SignalRow label="Topic affinity" value={signals.topicRelevance} weight="×0.8" />
        <SignalRow label="Author reputation" value={signals.authorReputation} weight="×1.1" />
        {signals.penalty > 0 && (
          <SignalRow label="Penalty" value={signals.penalty} weight="SUB" isNegative />
        )}
      </div>

      {/* Civility breakdown — surfaces specific issues that lowered the score */}
      {civility.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-warning-light shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold text-text-primary">
              Civility issues ({Math.round(civility.score * 100)}%)
            </span>
          </div>
          <div className="space-y-1.5">
            {civility.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-text-secondary">
                <AlertTriangle className="w-3 h-3 text-warning-light mt-0.5 shrink-0" aria-hidden="true" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {civility.issues.length === 0 && civility.score >= 0.8 && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-positive-light shrink-0" aria-hidden="true" />
            <span className="text-[11px] text-positive-light font-medium">
              This post promotes constructive civic discourse
            </span>
          </div>
        </div>
      )}

      {algorithm.explanationTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-subtle">
          {algorithm.explanationTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium text-text-muted bg-surface-active px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
