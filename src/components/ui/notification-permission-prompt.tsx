'use client';

// ═══════════════════════════════════════════════════════════════
// Notification Permission Prompt — Pre-permission explainer
// ═══════════════════════════════════════════════════════════════
//
// Shows a friendly in-app prompt explaining why notifications
// are useful BEFORE triggering the browser's native permission
// dialog. This "pre-prompt" pattern dramatically increases
// opt-in rates because users understand the value first.
//
// Timing: Shows after the user has been authenticated for at
// least 60 seconds and has not previously dismissed it.
//
// Platform notes:
//  - Desktop Chrome/Firefox/Edge: Full push notification support
//  - Android Chrome: Full support including PWA background push
//  - iOS Safari 16.4+: Push notifications supported in PWA mode
//    (home screen install required). Not supported in browser tab.
//  - iOS Safari <16.4: No push notification support at all
//  - If permission was previously denied, we show instructions
//    for re-enabling in browser settings instead of re-prompting.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Bell, X, Shield, MessageSquare, Settings } from 'lucide-react';
import clsx from 'clsx';

const STORAGE_KEY = 'civic-notif-prompt-dismissed';
const SHOW_DELAY = 60_000; // 60 seconds after auth

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function getPermissionState(): PermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function NotificationPermissionPrompt({ authenticated }: { authenticated: boolean }) {
  const [visible, setVisible] = useState(false);
  const [permState, setPermState] = useState<PermissionState>('default');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!authenticated) return;

    const state = getPermissionState();
    setPermState(state);

    // Don't show if already granted or if user dismissed
    if (state === 'granted') return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return;

    // iOS in browser (non-PWA) doesn't support push — show a different message
    // but still show the prompt to educate users

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [authenticated]);

  const handleEnable = useCallback(async () => {
    if (permState === 'denied') {
      // Can't re-prompt — direct user to settings
      return;
    }

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermState(result as PermissionState);
      if (result === 'granted') {
        // Register service worker for push if available
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw.js');
          } catch {
            // Non-critical
          }
        }
        setVisible(false);
      }
    } catch {
      // Permission request failed (rare)
    } finally {
      setRequesting(false);
    }
  }, [permState]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  if (!visible) return null;

  const isIOSBrowser = isIOS() && !isPWA();
  const isDenied = permState === 'denied';
  const isUnsupported = permState === 'unsupported';

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[190] w-[calc(100%-2rem)] max-w-md animate-slide-up">
      <div className="bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-civic-subtle flex items-center justify-center">
              <Bell className="w-4 h-4 text-civic-light" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Stay in the loop</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-4">
          {isDenied ? (
            <>
              <p className="text-xs text-text-secondary mb-3">
                Notifications are currently blocked. To re-enable them, open your browser settings and allow notifications for this site.
              </p>
              <div className="flex items-start gap-2 p-2.5 bg-surface-active rounded-xl mb-3">
                <Settings className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted">
                  <strong>Chrome:</strong> Click the lock icon in the address bar &gt; Site settings &gt; Notifications &gt; Allow
                </p>
              </div>
            </>
          ) : isIOSBrowser ? (
            <>
              <p className="text-xs text-text-secondary mb-3">
                To get notifications on iPhone/iPad, add Civic Social to your Home Screen first:
              </p>
              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2 p-2 bg-surface-active rounded-xl">
                  <span className="text-xs font-semibold text-civic-light shrink-0">1.</span>
                  <p className="text-xs text-text-muted">Tap the Share button in Safari</p>
                </div>
                <div className="flex items-start gap-2 p-2 bg-surface-active rounded-xl">
                  <span className="text-xs font-semibold text-civic-light shrink-0">2.</span>
                  <p className="text-xs text-text-muted">Tap &quot;Add to Home Screen&quot;</p>
                </div>
                <div className="flex items-start gap-2 p-2 bg-surface-active rounded-xl">
                  <span className="text-xs font-semibold text-civic-light shrink-0">3.</span>
                  <p className="text-xs text-text-muted">Open the app from your Home Screen, then enable notifications</p>
                </div>
              </div>
            </>
          ) : isUnsupported ? (
            <p className="text-xs text-text-secondary mb-3">
              Your browser doesn&apos;t support push notifications. You&apos;ll still see notification badges and in-app alerts when you visit.
            </p>
          ) : (
            <>
              <p className="text-xs text-text-secondary mb-3">
                Get notified when someone replies to your posts, invites you to a debate, or when important legislation updates drop.
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <MessageSquare className="w-3 h-3" /> Replies
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Shield className="w-3 h-3" /> Debates
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Bell className="w-3 h-3" /> Updates
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-text-muted hover:bg-surface-hover transition-colors"
            >
              Not now
            </button>
            {!isDenied && !isUnsupported && !isIOSBrowser && (
              <button
                onClick={handleEnable}
                disabled={requesting}
                className={clsx(
                  'flex-1 py-2 rounded-xl text-xs font-semibold transition-colors',
                  requesting ? 'bg-surface-active text-text-muted' : 'bg-civic text-white hover:bg-civic-dark',
                )}
              >
                {requesting ? 'Requesting...' : 'Enable notifications'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
