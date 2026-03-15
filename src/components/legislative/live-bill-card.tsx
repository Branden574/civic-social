'use client';

import Link from 'next/link';
import { Users, MessageSquare, Clock, ExternalLink, AlertCircle, Info, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { OfficialBillData } from '@/lib/legislation/types';

// ─── Status labels ───────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  introduced: 'Introduced',
  referred_to_committee: 'In Committee',
  reported_by_committee: 'Reported',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  resolving_differences: 'Conference',
  to_president: 'To President',
  became_law: 'Became Law',
  vetoed: 'Vetoed',
  failed: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  introduced: 'bg-surface-active text-text-muted',
  referred_to_committee: 'bg-info/10 text-info-light',
  reported_by_committee: 'bg-info/15 text-info-light',
  passed_house: 'bg-civic-subtle text-civic-light',
  passed_senate: 'bg-civic-subtle text-civic-light',
  resolving_differences: 'bg-warning/10 text-warning-light',
  to_president: 'bg-warning/15 text-warning-light',
  became_law: 'bg-positive/10 text-positive-light',
  vetoed: 'bg-danger/10 text-danger-light',
  failed: 'bg-danger/10 text-danger-light',
};

const PARTY_COLORS: Record<string, { bg: string; text: string }> = {
  D: { bg: 'bg-ideology-left/15', text: 'text-ideology-left' },
  R: { bg: 'bg-ideology-right/15', text: 'text-ideology-right' },
  I: { bg: 'bg-ideology-center/15', text: 'text-ideology-center' },
};

// ─── Props ───────────────────────────────────────────────────

interface LiveBillCardProps {
  bill: OfficialBillData;
  index: number;
}

// ─── Component ───────────────────────────────────────────────

export function LiveBillCard({ bill, index }: LiveBillCardProps) {
  const isDemo = bill.source === 'demo' || bill.syncStatus === 'demo';
  const isStale = bill.syncStatus === 'stale';

  // Build the canonical route link
  const billLink = `/legislation/${bill.key.country}/${bill.key.congress}/${bill.key.billType}/${bill.key.billNumber}`;

  const sponsorParty = bill.sponsor?.party || 'I';
  const partyColors = PARTY_COLORS[sponsorParty] || PARTY_COLORS.I;

  return (
    <Link
      href={billLink}
      className={clsx(
        'feed-item block rounded-xl border bg-surface p-4',
        'transition-colors duration-200 hover:bg-surface-hover hover:shadow-md',
        'animate-fade-in opacity-0',
        isDemo
          ? 'border-info/30 hover:border-info/50'
          : isStale
            ? 'border-warning/30 hover:border-warning/50'
            : 'border-border-subtle hover:border-border',
      )}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
    >
      {/* Demo / Stale indicator */}
      {isDemo && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-info-light">
          <Info className="w-3 h-3" />
          Demo data — not from official source
        </div>
      )}
      {isStale && !isDemo && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-warning-light">
          <AlertCircle className="w-3 h-3" />
          Stale data — last synced {new Date(bill.lastSyncedAt).toLocaleTimeString()}
        </div>
      )}

      {/* Top row: bill code + status badge */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold',
            bill.originChamber === 'Senate'
              ? 'bg-purple-500/15 text-purple-400'
              : 'bg-info/15 text-info-light',
          )}
        >
          {bill.billCode}
        </span>
        <span className="text-xs font-medium text-text-muted uppercase">
          {bill.originChamber}
        </span>
        <span className="text-xs text-text-muted">
          {bill.congress}th
        </span>
        <div className="flex-1" />
        <span
          className={clsx(
            'text-[9px] font-semibold px-2 py-0.5 rounded-full',
            STATUS_COLORS[bill.status] || 'bg-surface-active text-text-muted',
          )}
        >
          {STATUS_LABELS[bill.status] || bill.status}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-text-primary leading-snug mb-1">
        {bill.shortTitle || bill.officialTitle}
      </h3>

      {/* AI Summary or fallback to CRS summary / latest action */}
      {bill.aiSummary?.plainLanguage ? (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-civic-light" />
            <span className="text-[9px] font-semibold text-civic-light">AI Summary</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
            {bill.aiSummary.plainLanguage}
          </p>
        </div>
      ) : (
        <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
          {bill.officialSummary || bill.latestAction?.text || 'Summary not yet available from official sources.'}
        </p>
      )}

      {/* Subject tags */}
      {bill.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {bill.subjects.slice(0, 3).map((subject) => (
            <span
              key={subject}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-active text-text-muted text-xs font-medium"
            >
              {subject}
            </span>
          ))}
          {bill.subjects.length > 3 && (
            <span className="text-xs text-text-muted font-medium">
              +{bill.subjects.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          {bill.sponsor ? (
            <>
              <span className="text-xs text-text-secondary truncate">
                {bill.sponsor.fullName}
              </span>
              <span
                className={clsx(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold',
                  partyColors.bg,
                  partyColors.text,
                )}
              >
                {bill.sponsor.party}-{bill.sponsor.state}
              </span>
            </>
          ) : (
            <span className="text-xs text-text-muted italic">Sponsor data pending</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 text-text-muted">
          {/* Source indicator */}
          <span className="flex items-center gap-1 text-xs">
            <ExternalLink className="h-3 w-3" />
            {bill.source === 'congress_api' ? 'Official' : bill.source}
          </span>

          {/* Last updated */}
          {bill.latestAction?.date && (
            <span className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {bill.latestAction.date}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
