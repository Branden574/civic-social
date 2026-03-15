'use client';

import { ThumbsUp, ThumbsDown, Clock, Minus } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface VoteTallyDisplayProps {
  votes: {
    yea: number;
    nay: number;
    abstain: number;
    notVoting: number;
    total: number;
    result: 'passed' | 'failed' | 'pending';
    date: Date | null;
    partyBreakdown: {
      party: 'D' | 'R' | 'I';
      yea: number;
      nay: number;
    }[];
  };
  chamber: 'house' | 'senate';
  compact?: boolean;
}

const PARTY_LABELS: Record<string, string> = {
  D: 'Democrats',
  R: 'Republicans',
  I: 'Independents',
};

const PARTY_COLORS: Record<string, { bar: string; text: string }> = {
  D: { bar: 'bg-ideology-left', text: 'text-ideology-left' },
  R: { bar: 'bg-ideology-right', text: 'text-ideology-right' },
  I: { bar: 'bg-ideology-center', text: 'text-ideology-center' },
};

const RESULT_CONFIG = {
  passed: {
    label: 'Passed',
    bg: 'bg-positive/15',
    text: 'text-positive-light',
    border: 'border-positive/30',
    icon: ThumbsUp,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-danger/15',
    text: 'text-danger-light',
    border: 'border-danger/30',
    icon: ThumbsDown,
  },
  pending: {
    label: 'Pending',
    bg: 'bg-warning/15',
    text: 'text-warning-light',
    border: 'border-warning/30',
    icon: Clock,
  },
};

export function VoteTallyDisplay({ votes, chamber, compact = false }: VoteTallyDisplayProps) {
  const { yea, nay, abstain, notVoting, total, result, date, partyBreakdown } = votes;
  const resultConfig = RESULT_CONFIG[result];
  const ResultIcon = resultConfig.icon;
  const voteCast = yea + nay;
  const yeaPercent = voteCast > 0 ? (yea / voteCast) * 100 : 0;
  const nayPercent = voteCast > 0 ? (nay / voteCast) * 100 : 0;

  return (
    <div className={clsx('w-full', compact ? 'space-y-2' : 'space-y-4')}>
      {/* Main vote bar */}
      <div className="space-y-2">
        {/* Vote counts header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={clsx('font-bold text-positive-light', compact ? 'text-lg' : 'text-2xl')}>
              {yea}
            </span>
            <span className={clsx('font-medium text-text-muted', compact ? 'text-sm' : 'text-lg')}>
              Yea
            </span>
            <span className="text-text-muted mx-1">—</span>
            <span className={clsx('font-bold text-danger-light', compact ? 'text-lg' : 'text-2xl')}>
              {nay}
            </span>
            <span className={clsx('font-medium text-text-muted', compact ? 'text-sm' : 'text-lg')}>
              Nay
            </span>
          </div>

          {/* Result badge */}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold',
              resultConfig.bg,
              resultConfig.text,
              resultConfig.border,
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            <ResultIcon className={clsx(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            {resultConfig.label}
          </div>
        </div>

        {/* Proportional bar */}
        <div className="relative h-3 w-full rounded-full overflow-hidden bg-surface-active">
          <div
            className="absolute inset-y-0 left-0 bg-positive rounded-l-full transition-colors duration-500"
            style={{ width: `${yeaPercent}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-danger rounded-r-full transition-colors duration-500"
            style={{ width: `${nayPercent}%` }}
          />
        </div>

        {/* Abstain / Not voting info */}
        {!compact && (abstain > 0 || notVoting > 0) && (
          <div className="flex items-center gap-4 text-xs text-text-muted">
            {abstain > 0 && (
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3" />
                <span>{abstain} Abstain</span>
              </div>
            )}
            {notVoting > 0 && (
              <span>{notVoting} Not Voting</span>
            )}
            <span className="ml-auto">
              {chamber === 'senate' ? 'Senate' : 'House'} — {total} Members
            </span>
          </div>
        )}

        {/* Date */}
        {!compact && date && (
          <p className="text-xs text-text-muted">
            Voted {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Party breakdown */}
      {!compact && partyBreakdown.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <h4 className="text-xs font-semibold text-text-muted">
            Party Breakdown
          </h4>
          {partyBreakdown.map(({ party, yea: pYea, nay: pNay }) => {
            const pTotal = pYea + pNay;
            const pYeaPercent = pTotal > 0 ? (pYea / pTotal) * 100 : 0;
            const colors = PARTY_COLORS[party];

            return (
              <div key={party} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className={clsx('font-medium', colors.text)}>
                    {PARTY_LABELS[party]}
                  </span>
                  <span className="text-text-secondary text-xs">
                    {pYea} Yea · {pNay} Nay
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full overflow-hidden bg-surface-active">
                  <div
                    className={clsx('absolute inset-y-0 left-0 rounded-full transition-colors duration-500', colors.bar)}
                    style={{ width: `${pYeaPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
