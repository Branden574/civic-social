'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * AuthGate — wraps private pages. Redirects to "/" landing when logged out.
 * Shows nothing while auth is resolving (no flash of protected content).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // While auth is resolving, render nothing (splash screen handles loading UI)
  if (isLoading) return null;

  // Not authenticated — redirect in progress
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
