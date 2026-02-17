import { ProfileSkeleton, FeedSkeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="flex min-h-screen bg-bg">
      <div className="hidden lg:block w-[72px] xl:w-64 shrink-0" />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          <ProfileSkeleton />
          <div className="mt-6">
            <FeedSkeleton count={4} />
          </div>
        </div>
      </main>
    </div>
  );
}
