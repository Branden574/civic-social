import { DebateCardSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function DebatesLoading() {
  return (
    <div className="flex min-h-screen bg-bg">
      <div className="hidden lg:block w-[72px] xl:w-64 shrink-0" />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          <div className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          </div>
          <DebateCardSkeleton count={4} />
        </div>
      </main>
    </div>
  );
}
