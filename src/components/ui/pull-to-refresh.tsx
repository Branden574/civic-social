'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;     // pixels to pull before triggering
const MAX_PULL = 120;     // max pull distance
const RESISTANCE = 0.4;   // pull resistance factor

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    // Check if the scrollable ancestor is at top
    let el: HTMLElement | null = containerRef.current;
    while (el) {
      if (el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    return true;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      setPulling(true);
    },
    [isAtTop],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling || refreshing) return;
      const currentY = e.touches[0].clientY;
      const delta = (currentY - startY.current) * RESISTANCE;
      if (delta > 0) {
        setPullDistance(Math.min(delta, MAX_PULL));
      }
    },
    [pulling, refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6); // snap to loading position
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = pullDistance * 3;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className={clsx(
          'absolute left-0 right-0 flex items-center justify-center z-30 transition-opacity pointer-events-none',
          pullDistance > 0 || refreshing ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          top: -8,
          height: `${Math.max(pullDistance, refreshing ? THRESHOLD * 0.6 : 0)}px`,
        }}
      >
        <div
          className={clsx(
            'flex items-center justify-center w-9 h-9 rounded-full border transition-colors',
            refreshing
              ? 'bg-civic-muted border-civic/30'
              : progress >= 1
                ? 'bg-positive/15 border-positive/30'
                : 'bg-surface-elevated border-border-subtle',
          )}
          style={{
            transform: `rotate(${refreshing ? 0 : rotation}deg) scale(${0.6 + progress * 0.4})`,
          }}
        >
          <RefreshCw
            className={clsx(
              'w-4 h-4 transition-colors',
              refreshing
                ? 'text-civic-light animate-spin'
                : progress >= 1
                  ? 'text-positive-light'
                  : 'text-text-muted',
            )}
          />
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? THRESHOLD * 0.5 : 0) : 0}px)`,
          transition: pulling ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
