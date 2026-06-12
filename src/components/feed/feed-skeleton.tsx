'use client';

import { Skeleton } from '@/components/ui/skeleton';

// ─── Feed Post Skeleton (card-shaped, shimmer) ───────────────
// Mirrors the prototype post card: 14px/18px padding, hairline
// divider, avatar + meta header, staggered content lines, and a
// reaction row. Widths vary per index for an organic feel.

const CONTENT_WIDTHS: [string, string, string][] = [
  ['w-full', 'w-[92%]', 'w-[64%]'],
  ['w-[96%]', 'w-full', 'w-[48%]'],
  ['w-full', 'w-[84%]', 'w-[71%]'],
  ['w-[90%]', 'w-full', 'w-[56%]'],
  ['w-full', 'w-[88%]', 'w-[40%]'],
];

function FeedPostSkeleton({ index = 0 }: { index?: number }) {
  const [w1, w2, w3] = CONTENT_WIDTHS[index % CONTENT_WIDTHS.length];
  return (
    <div className="px-[18px] pt-3.5 pb-3 border-b border-border-hairline">
      {/* Author row */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-[38px] h-[38px] rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2 pt-0.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-5 w-[72px] rounded-full shrink-0" />
      </div>
      {/* Content lines */}
      <div className="mt-3 space-y-2.5">
        <Skeleton className={`h-3 ${w1}`} />
        <Skeleton className={`h-3 ${w2}`} />
        <Skeleton className={`h-3 ${w3}`} />
      </div>
      {/* Reaction row */}
      <div className="flex items-center gap-2 mt-4 mb-1">
        <Skeleton className="h-7 w-[68px] rounded-full" />
        <Skeleton className="h-7 w-[68px] rounded-full" />
        <Skeleton className="h-7 w-[68px] rounded-full" />
        <Skeleton className="h-7 w-9 rounded-full ml-auto" />
      </div>
    </div>
  );
}

export function FeedPostsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <FeedPostSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
