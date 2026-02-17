'use client';

import clsx from 'clsx';

// ─── Base Skeleton ───────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

export function Skeleton({ className, shimmer = true }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-lg',
        shimmer ? 'skeleton-shimmer' : 'bg-surface-elevated animate-skeleton',
        className,
      )}
    />
  );
}

// ─── Post Card Skeleton ──────────────────────────────────────

export function PostCardSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-5 border-b border-border-subtle">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="ml-[52px] space-y-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[90%]" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Feed Skeleton (multiple posts) ──────────────────────────

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Thread Skeleton ─────────────────────────────────────────

export function ThreadSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Main post skeleton */}
      <div className="px-4 sm:px-6 py-5 border-b border-border-subtle">
        <div className="flex items-start gap-3 mb-4">
          <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-3 mt-5">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      {/* Reply skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-4 sm:px-6 py-4 border-b border-border-subtle ml-6">
          <div className="flex items-start gap-3 mb-2">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile Skeleton ────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="h-32 w-full rounded-none" shimmer={false} />
      <div className="px-4 sm:px-6 -mt-12">
        <Skeleton className="w-24 h-24 rounded-2xl border-4 border-bg" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full max-w-sm" />
        </div>
        <div className="flex gap-6 mt-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

// ─── Article Skeleton ────────────────────────────────────────

export function ArticleSkeleton() {
  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <Skeleton className="h-48 w-full rounded-xl mb-4" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── Notification Skeleton ──────────────────────────────────

export function NotificationSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="px-4 sm:px-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-4 border-b border-border-subtle">
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Legislation/Bill Skeleton ──────────────────────────────

export function BillCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 bg-surface-elevated rounded-xl border border-border-subtle">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Debate Card Skeleton ───────────────────────────────────

export function DebateCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 bg-surface-elevated rounded-xl border border-border-subtle">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-5 w-4/5 mb-2" />
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-4 w-8 self-center" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page-level skeleton wrapper ────────────────────────────

export function PageSkeleton({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      {header && (
        <div className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 py-4">
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
