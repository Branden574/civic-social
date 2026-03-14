'use client';

import Link from 'next/link';
import { AlertTriangle, Zap, Users, MessageSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { BillProgress } from './bill-progress';

interface BillCardProps {
  bill: {
    id: string;
    number: string;
    shortTitle: string;
    quickSummary: string;
    status: string;
    chamber: 'house' | 'senate';
    sponsor: { name: string; party: string; state: string };
    topics: string[];
    lastActionDate: Date;
    isControversial: boolean;
    isHighImpact: boolean;
    followersCount: number;
    discussionCount: number;
    votes?: { yea: number; nay: number; result: string };
  };
  index: number;
}

const PARTY_COLORS: Record<string, { bg: string; text: string }> = {
  D: { bg: 'bg-ideology-left/15', text: 'text-ideology-left' },
  R: { bg: 'bg-ideology-right/15', text: 'text-ideology-right' },
  I: { bg: 'bg-ideology-center/15', text: 'text-ideology-center' },
};

function formatBillNumber(number: string, chamber: 'house' | 'senate') {
  if (number.startsWith('H.R.') || number.startsWith('S.')) return number;
  return chamber === 'house' ? `H.R. ${number}` : `S. ${number}`;
}

export function BillCard({ bill, index }: BillCardProps) {
  const partyColors = PARTY_COLORS[bill.sponsor.party] || PARTY_COLORS.I;
  const formattedNumber = formatBillNumber(bill.number, bill.chamber);

  return (
    <Link
      href={`/labs/${bill.id}`}
      className={clsx(
        'feed-item block rounded-xl border border-border-subtle bg-surface p-4',
        'transition-all duration-200 hover:bg-surface-hover hover:border-border hover:shadow-md',
        'animate-fade-in opacity-0'
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
    >
      {/* Top row: bill number + badges */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {/* Chamber & bill number */}
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider',
            bill.chamber === 'senate'
              ? 'bg-civic-muted text-civic-light'
              : 'bg-info/15 text-info-light'
          )}
        >
          {formattedNumber}
        </span>

        {/* Chamber badge */}
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {bill.chamber === 'senate' ? 'Senate' : 'House'}
        </span>

        <div className="flex-1" />

        {/* Alert badges */}
        {bill.isControversial && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning-light text-xs font-semibold border border-warning/20">
            <AlertTriangle className="h-3 w-3" />
            Controversial
          </span>
        )}
        {bill.isHighImpact && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-civic-muted text-civic-light text-xs font-semibold border border-civic/20">
            <Zap className="h-3 w-3" />
            High Impact
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-text-primary leading-snug mb-1">
        {bill.shortTitle}
      </h3>

      {/* Summary - truncated 2 lines */}
      <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
        {bill.quickSummary}
      </p>

      {/* Progress bar */}
      <div className="mb-3">
        <BillProgress currentStatus={bill.status} compact />
      </div>

      {/* Topic tags */}
      {bill.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {bill.topics.slice(0, 4).map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-active text-text-muted text-xs font-medium"
            >
              {topic}
            </span>
          ))}
          {bill.topics.length > 4 && (
            <span className="text-xs text-text-muted font-medium">
              +{bill.topics.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Inline vote result */}
      {bill.votes && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-surface-active/50">
          {bill.votes.result === 'passed' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-positive-light" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-danger-light" />
          )}
          <span className="text-xs text-text-secondary">
            <span className="font-semibold text-positive-light">{bill.votes.yea}</span>
            {' — '}
            <span className="font-semibold text-danger-light">{bill.votes.nay}</span>
          </span>
          <span
            className={clsx(
              'text-xs font-semibold uppercase',
              bill.votes.result === 'passed' ? 'text-positive-light' : 'text-danger-light'
            )}
          >
            {bill.votes.result}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          {/* Sponsor */}
          <span className="text-xs text-text-secondary truncate">
            {bill.sponsor.name}
          </span>
          <span
            className={clsx(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold',
              partyColors.bg,
              partyColors.text
            )}
          >
            {bill.sponsor.party}-{bill.sponsor.state}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-text-muted">
          {/* Followers */}
          <span className="flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {bill.followersCount.toLocaleString()}
          </span>

          {/* Discussion */}
          <span className="flex items-center gap-1 text-xs">
            <MessageSquare className="h-3 w-3" />
            {bill.discussionCount.toLocaleString()}
          </span>

          {/* Last updated */}
          <span className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(bill.lastActionDate), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
