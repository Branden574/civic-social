import { FeedSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar placeholder */}
      <div className="hidden lg:block w-[72px] xl:w-64 shrink-0" />
      <main className="flex-1 min-w-0 border-r border-border-subtle">
        <div className="max-w-2xl mx-auto">
          {/* Header skeleton */}
          <div className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-0">
              <Skeleton className="h-5 w-28 lg:hidden" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-7 w-24 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
            <div className="flex px-4 sm:px-6 mt-2">
              <Skeleton className="flex-1 h-8 rounded-none" shimmer={false} />
              <Skeleton className="flex-1 h-8 rounded-none" shimmer={false} />
            </div>
          </div>
          <FeedSkeleton count={6} />
        </div>
      </main>
    </div>
  );
}
