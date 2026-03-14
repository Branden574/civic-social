'use client';

import { useState, useCallback, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

// ═══════════════════════════════════════════════════════════════
// Micro-interaction primitives for premium UI
// ═══════════════════════════════════════════════════════════════

// ─── Haptic feedback (mobile only) ───────────────────────────

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    const pattern = style === 'heavy' ? 30 : style === 'medium' ? 15 : 8;
    navigator.vibrate(pattern);
  }
}

// ─── Animated Like / Reaction Button ─────────────────────────

interface ReactionButtonProps {
  icon: ReactNode;
  activeIcon?: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onToggle: (newState: boolean) => void;
  size?: 'sm' | 'md';
}

export function ReactionButton({
  icon,
  activeIcon,
  label,
  count,
  active = false,
  activeColor = 'text-civic-light',
  onToggle,
  size = 'sm',
}: ReactionButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [localActive, setLocalActive] = useState(active);
  const [localCount, setLocalCount] = useState(count ?? 0);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const particleId = useRef(0);

  const handleClick = useCallback(() => {
    const newState = !localActive;
    setLocalActive(newState);
    setLocalCount((c) => (newState ? c + 1 : Math.max(0, c - 1)));
    setIsAnimating(true);
    triggerHaptic(newState ? 'medium' : 'light');

    // Particle burst on activate
    if (newState) {
      const newParticles = Array.from({ length: 5 }, () => ({
        id: particleId.current++,
        x: (Math.random() - 0.5) * 40,
        y: -Math.random() * 30 - 10,
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 600);
    }

    setTimeout(() => setIsAnimating(false), 600);
    onToggle(newState);
  }, [localActive, onToggle]);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'relative flex items-center gap-1 rounded-lg transition-all duration-150 active:scale-90',
        size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        localActive
          ? `${activeColor} font-semibold`
          : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
      )}
      aria-label={label}
      aria-pressed={localActive}
    >
      {/* Particle effects */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute w-1 h-1 rounded-full pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            background: 'currentColor',
            opacity: 0,
            transform: `translate(${p.x}px, ${p.y}px) scale(0)`,
            animation: 'popIn 0.4s var(--ease-spring) forwards',
          }}
        />
      ))}

      {/* Icon */}
      <span className={clsx(isAnimating && localActive && 'animate-heart-beat')}>
        {localActive && activeIcon ? activeIcon : icon}
      </span>

      {/* Count */}
      {localCount > 0 && (
        <span className={clsx('tabular-nums transition-all duration-200', isAnimating && 'scale-110')}>
          {formatCompact(localCount)}
        </span>
      )}
    </button>
  );
}

// ─── Animated Bookmark Button ────────────────────────────────

interface BookmarkButtonProps {
  bookmarked: boolean;
  onToggle: (newState: boolean) => void;
}

export function BookmarkButton({ bookmarked, onToggle }: BookmarkButtonProps) {
  const [animating, setAnimating] = useState(false);

  const handleClick = useCallback(() => {
    setAnimating(true);
    triggerHaptic(bookmarked ? 'light' : 'medium');
    onToggle(!bookmarked);
    setTimeout(() => setAnimating(false), 500);
  }, [bookmarked, onToggle]);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'p-1.5 rounded-lg transition-all duration-150 active:scale-90',
        bookmarked
          ? 'text-warning-light'
          : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
      )}
      aria-label={bookmarked ? 'Remove bookmark' : 'Save post'}
    >
      <svg
        className={clsx('w-4 h-4 transition-transform', animating && 'animate-pop-in')}
        viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

// ─── New Posts Banner ────────────────────────────────────────

interface NewPostsBannerProps {
  visible: boolean;
  count?: number;
  onClick: () => void;
}

export function NewPostsBanner({ visible, count, onClick }: NewPostsBannerProps) {
  if (!visible) return null;

  return (
    <button
      onClick={() => {
        triggerHaptic('light');
        onClick();
      }}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-civic-subtle text-civic-light text-sm font-semibold border-b border-civic/20 hover:bg-civic-muted transition-all duration-200 animate-slide-down cursor-pointer active:scale-[0.99]"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-civic animate-pulse" />
      {count ? `${count} new posts` : 'New posts available'}
      <span className="text-xs text-civic/60">Tap to refresh</span>
    </button>
  );
}

// ─── Tab Bar with Animated Indicator ─────────────────────────

interface AnimatedTabBarProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function AnimatedTabBar({ tabs, activeTab, onChange }: AnimatedTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const handleTabClick = useCallback((tabId: string, el: HTMLButtonElement) => {
    onChange(tabId);
    triggerHaptic('light');
    // Update indicator position
    const rect = el.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setIndicatorStyle({
        left: rect.left - containerRect.left,
        width: rect.width,
      });
    }
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative flex border-b border-border-subtle">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (tab.id === activeTab && el) {
              const rect = el.getBoundingClientRect();
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect && indicatorStyle.width === 0) {
                setIndicatorStyle({
                  left: rect.left - containerRect.left,
                  width: rect.width,
                });
              }
            }
          }}
          onClick={(e) => handleTabClick(tab.id, e.currentTarget)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-150 relative',
            activeTab === tab.id
              ? 'text-civic-light'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="text-xs font-bold px-1 py-0.5 rounded-full bg-civic-muted text-civic-light min-w-[18px] text-center">
              {tab.count}
            </span>
          )}
        </button>
      ))}
      {/* Animated indicator */}
      <div
        className="absolute bottom-0 h-[2px] bg-civic rounded-full transition-all duration-250"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </div>
  );
}

// ─── Utilities ───────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
