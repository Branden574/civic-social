'use client';

// ═══════════════════════════════════════════════════════════════
// In-App Notification Toast Banner
// ═══════════════════════════════════════════════════════════════
//
// Shows a slide-down toast when a new notification is received
// while the app is in the foreground. Auto-dismisses after 5s.
// Clicking navigates to the relevant content.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, ThumbsUp, MessageSquare, UserPlus, Scale, Newspaper, Shield } from 'lucide-react';
import clsx from 'clsx';

interface NotificationToastData {
  id: string;
  type: string;
  actorName?: string;
  preview?: string;
  entityId?: string;
  entityType?: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  follow: { icon: UserPlus, color: 'text-civic-light', label: 'started following you' },
  like: { icon: ThumbsUp, color: 'text-positive-light', label: 'reacted to your post' },
  reply: { icon: MessageSquare, color: 'text-info-light', label: 'replied to your post' },
  mention: { icon: Bell, color: 'text-warning-light', label: 'mentioned you' },
  debate_invite: { icon: Scale, color: 'text-warning-light', label: 'invited you to a debate' },
  post_from_followed: { icon: Newspaper, color: 'text-civic-light', label: 'published a new post' },
  system: { icon: Shield, color: 'text-text-muted', label: 'System notification' },
};

export function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: NotificationToastData;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 5s
    const hideTimer = setTimeout(() => dismiss(), 5000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleClick = useCallback(() => {
    dismiss();
    if (notification.entityType === 'debate' && notification.entityId) {
      router.push(`/debates/${notification.entityId}`);
    } else if (notification.entityType === 'user' && notification.entityId) {
      router.push(`/profile/${notification.entityId}`);
    } else if (notification.entityId) {
      router.push(`/post/${notification.entityId}`);
    } else {
      router.push('/notifications');
    }
  }, [notification, router, dismiss]);

  const config = typeConfig[notification.type] || typeConfig.system;
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-md',
        'transition-all duration-300 ease-out',
        visible && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
        className="w-full flex items-start gap-3 p-3.5 bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl backdrop-blur-xl text-left hover:bg-surface-hover transition-colors active:scale-[0.98] cursor-pointer"
      >
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', config.color, 'bg-surface-active')}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {notification.actorName || 'Someone'}{' '}
            <span className="font-normal text-text-secondary">{config.label}</span>
          </p>
          {notification.preview && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{notification.preview}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
