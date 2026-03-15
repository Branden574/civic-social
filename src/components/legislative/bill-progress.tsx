'use client';

import { Check, X } from 'lucide-react';
import clsx from 'clsx';

interface BillProgressProps {
  currentStatus: string;
  compact?: boolean;
}

const STATUS_ORDER = [
  'introduced',
  'committee',
  'floor',
  'passed_chamber',
  'conference',
  'passed_both',
  'signed',
] as const;

const STATUS_LABELS: Record<string, string> = {
  introduced: 'Introduced',
  committee: 'Committee',
  floor: 'Floor Vote',
  passed_chamber: 'Passed Chamber',
  conference: 'Conference',
  passed_both: 'Passed Both',
  signed: 'Signed Into Law',
};

const COMPACT_LABELS: Record<string, string> = {
  introduced: 'Intro',
  committee: 'Comm',
  floor: 'Floor',
  passed_chamber: 'Passed',
  conference: 'Conf',
  passed_both: 'Both',
  signed: 'Signed',
};

export function BillProgress({ currentStatus, compact = false }: BillProgressProps) {
  const isFailed = currentStatus === 'failed' || currentStatus === 'vetoed';
  const effectiveStatus = isFailed ? 'signed' : currentStatus;
  const currentIndex = STATUS_ORDER.indexOf(effectiveStatus as (typeof STATUS_ORDER)[number]);

  return (
    <div className={clsx('w-full', compact ? 'py-1' : 'py-3')}>
      <div className="relative flex items-center justify-between">
        {STATUS_ORDER.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFinalFailed = isFailed && isCurrent;

          return (
            <div
              key={status}
              className="group relative flex flex-col items-center"
              style={{ flex: index === STATUS_ORDER.length - 1 ? '0 0 auto' : '1 1 0%' }}
            >
              {/* Connecting line */}
              {index < STATUS_ORDER.length - 1 && (
                <div
                  className={clsx(
                    'absolute top-1/2 -translate-y-1/2 h-0.5',
                    compact ? 'left-3 right-0' : 'left-4 right-0',
                    isCompleted ? 'bg-civic' : 'bg-surface-active'
                  )}
                  style={{ zIndex: 0 }}
                />
              )}

              {/* Step dot */}
              <div
                className={clsx(
                  'relative z-10 flex items-center justify-center rounded-full border-2 transition-colors duration-300',
                  compact ? 'h-6 w-6' : 'h-8 w-8',
                  isFinalFailed && 'border-danger bg-danger',
                  !isFinalFailed && isCompleted && 'border-civic bg-civic',
                  !isFinalFailed && isCurrent && 'border-civic bg-civic animate-pulse-glow',
                  !isFinalFailed && !isCompleted && !isCurrent && 'border-border-subtle bg-surface-active'
                )}
              >
                {isFinalFailed ? (
                  <X className={clsx('text-white', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                ) : isCompleted ? (
                  <Check className={clsx('text-white', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                ) : isCurrent ? (
                  <div className={clsx('rounded-full bg-white', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
                ) : (
                  <div className={clsx('rounded-full bg-text-muted', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
                )}
              </div>

              {/* Hover tooltip */}
              <div
                className={clsx(
                  'absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                  'bg-surface-elevated text-text-primary text-xs font-medium px-2 py-1 rounded-md shadow-md',
                  'border border-border-subtle whitespace-nowrap',
                  compact ? '-bottom-7' : '-bottom-8'
                )}
              >
                {STATUS_LABELS[status]}
              </div>

              {/* Labels (non-compact only) */}
              {!compact && (
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium leading-tight text-center hidden sm:block',
                    isFinalFailed && 'text-danger-light',
                    !isFinalFailed && (isCompleted || isCurrent) && 'text-civic-light',
                    !isFinalFailed && !isCompleted && !isCurrent && 'text-text-muted'
                  )}
                >
                  {STATUS_LABELS[status]}
                </span>
              )}

              {/* Compact labels */}
              {compact && (
                <span
                  className={clsx(
                    'mt-1 text-[8px] font-medium leading-tight text-center hidden sm:block',
                    isFinalFailed && 'text-danger-light',
                    !isFinalFailed && (isCompleted || isCurrent) && 'text-civic-light',
                    !isFinalFailed && !isCompleted && !isCurrent && 'text-text-muted'
                  )}
                >
                  {COMPACT_LABELS[status]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Failed/vetoed label */}
      {isFailed && (
        <div className="mt-2 flex justify-end">
          <span className="text-xs font-semibold text-danger-light uppercase">
            {currentStatus === 'vetoed' ? 'Vetoed' : 'Failed'}
          </span>
        </div>
      )}
    </div>
  );
}
