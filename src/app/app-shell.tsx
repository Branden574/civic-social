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
import { NotificationToast } from '@/components/ui/notification-toast';
import { NotificationPermissionPrompt } from '@/components/ui/notification-permission-prompt';
import { PerfProvider, PerfPanel } from '@/lib/performance';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notification-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const { activeToast, dismissToast } = useNotifications();

  return (
    <PerfProvider>
      <SplashScreen ready={!isLoading}>
        {children}
      </SplashScreen>
      <PerfPanel />

      {/* In-app notification toast (foreground alerts) */}
      {activeToast && (
        <NotificationToast notification={activeToast} onDismiss={dismissToast} />
      )}

      {/* Notification permission pre-prompt */}
      <NotificationPermissionPrompt authenticated={isAuthenticated} />
    </PerfProvider>
  );
}
