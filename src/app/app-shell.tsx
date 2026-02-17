'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — App Shell
// ═══════════════════════════════════════════════════════════════
//
// Wraps the entire app with:
//  1. SplashScreen — premium loading during cold start
//  2. PerfProvider — performance instrumentation (dev panel)
//
// The splash screen dismisses once auth is resolved.
// ═══════════════════════════════════════════════════════════════

import { SplashScreen } from '@/components/ui/splash-screen';
import { PerfProvider, PerfPanel } from '@/lib/performance';
import { useAuth } from '@/lib/auth-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  return (
    <PerfProvider>
      <SplashScreen ready={!isLoading}>
        {children}
      </SplashScreen>
      <PerfPanel />
    </PerfProvider>
  );
}
