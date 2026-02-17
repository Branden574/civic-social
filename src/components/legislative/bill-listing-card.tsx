'use client';

import Link from 'next/link';
import { Clock, ExternalLink, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import type { BillListingItem } from '@/lib/legislation/types';

// ─── Chamber colors ─────────────────────────────────────────

const CHAMBER_STYLE: Record<string, string> = {
  House: 'bg-info/15 text-info-light',
  Senate: 'bg-purple-500/15 text-purple-400',
};

// ─── Component ───────────────────────────────────────────────

interface BillListingCardProps {
  bill: BillListingItem;
  index: number;
}

export function BillListingCard({ bill, index }: BillListingCardProps) {
  // Build the canonical route link
  const billLink = `/legislation/US/${bill.congress}/${bill.typeLower}/${bill.number}`;

  const chamberStyle = CHAMBER_STYLE[bill.originChamber] || 'bg-surface-active text-text-muted';

  // Format the update date nicely
  const updatedDate = bill.updateDate ? new Date(bill.updateDate) : null;
  const formattedDate = updatedDate
    ? updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Link
      href={billLink}
      className={clsx(
        'block rounded-xl border border-border-subtle bg-surface p-4',
        'transition-all duration-200 hover:bg-surface-hover hover:border-border hover:shadow-md',
        'animate-fade-in opacity-0',
      )}
      style={{ animationDelay: `${Math.min(index, 20) * 30}ms`, animationFillMode: 'forwards' }}
    >
      {/* Top row: bill code + chamber */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
            chamberStyle,
          )}
        >
          {bill.displayCode}
        </span>
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
          {bill.originChamber}
        </span>
        <span className="text-[10px] text-text-muted">
          {bill.congress}th Congress
        </span>
        <div className="flex-1" />
        <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-text-primary leading-snug mb-1.5 line-clamp-2">
        {bill.title}
      </h3>

      {/* Latest action */}
      {bill.latestActionText && (
        <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
          {bill.latestActionText}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
        <div className="flex items-center gap-2 text-text-muted">
          {bill.latestActionDate && (
            <span className="flex items-center gap-1 text-[10px]">
              <Clock className="h-3 w-3" />
              Last action: {bill.latestActionDate}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          {formattedDate && (
            <span className="text-[10px]">
              Updated {formattedDate}
            </span>
          )}
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}
