'use client';

import { Circle, FileText, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

interface BillTimelineProps {
  events: {
    status: string;
    date: Date;
    description: string;
  }[];
  amendments?: {
    id: string;
    number: string;
    title: string;
    status: 'proposed' | 'adopted' | 'rejected' | 'withdrawn';
    date: Date;
    sponsor: { name: string; party: string };
  }[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  introduced: { bg: 'bg-info/15', text: 'text-info-light', border: 'border-info/30' },
  committee: { bg: 'bg-warning/15', text: 'text-warning-light', border: 'border-warning/30' },
  floor: { bg: 'bg-civic/15', text: 'text-civic-light', border: 'border-civic/30' },
  passed_chamber: { bg: 'bg-positive/15', text: 'text-positive-light', border: 'border-positive/30' },
  conference: { bg: 'bg-warning/15', text: 'text-warning-light', border: 'border-warning/30' },
  passed_both: { bg: 'bg-positive/15', text: 'text-positive-light', border: 'border-positive/30' },
  signed: { bg: 'bg-positive/15', text: 'text-positive-light', border: 'border-positive/30' },
  vetoed: { bg: 'bg-danger/15', text: 'text-danger-light', border: 'border-danger/30' },
  failed: { bg: 'bg-danger/15', text: 'text-danger-light', border: 'border-danger/30' },
};

const AMENDMENT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  adopted: { bg: 'bg-positive/15', text: 'text-positive-light', border: 'border-positive/30' },
  rejected: { bg: 'bg-danger/15', text: 'text-danger-light', border: 'border-danger/30' },
  proposed: { bg: 'bg-info/15', text: 'text-info-light', border: 'border-info/30' },
  withdrawn: { bg: 'bg-surface-active', text: 'text-text-muted', border: 'border-border-subtle' },
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'signed':
    case 'passed_chamber':
    case 'passed_both':
      return CheckCircle2;
    case 'vetoed':
    case 'failed':
      return XCircle;
    case 'committee':
    case 'conference':
      return Clock;
    default:
      return Circle;
  }
}

type TimelineItem =
  | { type: 'event'; status: string; date: Date; description: string }
  | {
      type: 'amendment';
      id: string;
      number: string;
      title: string;
      status: 'proposed' | 'adopted' | 'rejected' | 'withdrawn';
      date: Date;
      sponsor: { name: string; party: string };
    };

export function BillTimeline({ events, amendments = [] }: BillTimelineProps) {
  // Merge events and amendments into a single sorted timeline
  const timelineItems: TimelineItem[] = [
    ...events.map((e) => ({ type: 'event' as const, ...e })),
    ...amendments.map((a) => ({ type: 'amendment' as const, ...a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (timelineItems.length === 0) {
    return (
      <div className="py-8 text-center text-text-muted text-sm">
        No timeline events available.
      </div>
    );
  }

  return (
    <div className="relative">
      {timelineItems.map((item, index) => {
        const isLast = index === timelineItems.length - 1;
        const itemDate = new Date(item.date);

        if (item.type === 'amendment') {
          const styles = AMENDMENT_STYLES[item.status] || AMENDMENT_STYLES.proposed;

          return (
            <div key={`amendment-${item.id}`} className="relative flex gap-4 pb-6">
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border-subtle" />
              )}

              {/* Icon */}
              <div
                className={clsx(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                  styles.bg,
                  styles.border
                )}
              >
                <FileText className={clsx('h-4 w-4', styles.text)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
                      styles.bg,
                      styles.text,
                      styles.border
                    )}
                  >
                    Amendment {item.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    {format(itemDate, 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-sm font-medium text-text-primary">
                  {item.number}: {item.title}
                </p>
                <p className="text-xs text-text-secondary">
                  Sponsored by{' '}
                  <span className="font-medium text-text-primary">{item.sponsor.name}</span>
                  <span className="text-text-muted"> ({item.sponsor.party})</span>
                </p>
              </div>
            </div>
          );
        }

        // Event item
        const styles = STATUS_STYLES[item.status] || STATUS_STYLES.introduced;
        const StatusIcon = getStatusIcon(item.status);

        return (
          <div key={`event-${index}`} className="relative flex gap-4 pb-6">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border-subtle" />
            )}

            {/* Icon */}
            <div
              className={clsx(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                styles.bg,
                styles.border
              )}
            >
              <StatusIcon className={clsx('h-4 w-4', styles.text)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
                    styles.bg,
                    styles.text,
                    styles.border
                  )}
                >
                  {item.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-text-muted">
                  {format(itemDate, 'MMM d, yyyy')}
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
