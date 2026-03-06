import { Search, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Search className="w-8 h-8 text-accent" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-text-primary">404</h1>
          <h2 className="text-xl font-semibold text-text-primary">
            Page not found
          </h2>
          <p className="text-text-secondary text-sm">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to feed
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-bg-alt text-text-primary font-medium text-sm hover:bg-bg-alt/80 transition-colors border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
