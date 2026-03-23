'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent,
  type AnchorHTMLAttributes,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════
// View Transitions — Cinematic page transitions via View Transitions API
// ═══════════════════════════════════════════════════════════════

// View Transitions API types are built-in to TypeScript 5.x+

// ─── Context ─────────────────────────────────────────────────

interface ViewTransitionContextValue {
  push: (href: string, options?: TransitionOptions) => void;
}

interface TransitionOptions {
  transitionType?: string;
}

const ViewTransitionContext = createContext<ViewTransitionContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────

export function ViewTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // Track pathname for back-navigation direction detection
  useEffect(() => {
    prevPathname.current = pathname;
  }, [pathname]);

  const push = useCallback(
    (href: string, options?: TransitionOptions) => {
      if (!('startViewTransition' in document) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        router.push(href);
        return;
      }

      const type = options?.transitionType || 'default';
      document.documentElement.dataset.transitionType = type;

      const transition = document.startViewTransition(async () => {
        router.push(href);
        // Wait for React to commit the new page
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => setTimeout(resolve, 0));
        });
      });

      transition.finished.then(() => {
        delete document.documentElement.dataset.transitionType;
      });
    },
    [router],
  );

  // Handle browser back/forward with view transitions
  useEffect(() => {
    const handlePopState = () => {
      if ('startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.dataset.transitionType = 'nav-back';
        // The browser handles the actual navigation; we just tag it
        // Clean up after transition settles
        setTimeout(() => {
          delete document.documentElement.dataset.transitionType;
        }, 500);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <ViewTransitionContext.Provider value={{ push }}>
      {children}
    </ViewTransitionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export function useViewTransitionRouter() {
  const ctx = useContext(ViewTransitionContext);
  const router = useRouter();

  if (!ctx) {
    // Fallback: if used outside provider, just use normal router
    return { push: router.push, back: router.back };
  }

  return { push: ctx.push, back: router.back };
}

// ─── TransitionLink ──────────────────────────────────────────

interface TransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  transitionType?: string;
  viewTransitionName?: string;
  children: ReactNode;
}

export function TransitionLink({
  href,
  transitionType,
  viewTransitionName,
  children,
  onClick,
  ...props
}: TransitionLinkProps) {
  const ctx = useContext(ViewTransitionContext);
  const router = useRouter();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let modifier-key clicks pass through (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      e.preventDefault();
      onClick?.(e);

      const el = e.currentTarget;

      // Set viewTransitionName on the clicked element right before transitioning
      // This avoids duplicate-name conflicts when multiple elements share a name pattern
      if (viewTransitionName) {
        el.style.viewTransitionName = viewTransitionName;
      }

      if (ctx) {
        ctx.push(href, { transitionType });
      } else {
        router.push(href);
      }
    },
    [ctx, router, href, transitionType, viewTransitionName, onClick],
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

// ─── Nav Direction Helper ────────────────────────────────────

const NAV_ORDER: Record<string, number> = {
  '/': 0,
  '/search': 1,
  '/news': 2,
  '/labs': 3,
  '/debates': 4,
  '/notifications': 5,
  '/profile': 6,
  '/saved': 7,
  '/settings': 8,
};

export function getNavTransitionType(from: string, to: string): string {
  const fromIndex = NAV_ORDER[from] ?? -1;
  const toIndex = NAV_ORDER[to] ?? -1;
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return 'default';
  return toIndex > fromIndex ? 'nav-forward' : 'nav-back';
}
