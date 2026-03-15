'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Newspaper,
  Landmark,
  MessageSquare,
  Bell,
  User,
  Settings,
  Shield,
  PenSquare,
  Search,
  Bookmark,
  ShieldAlert,
  Scale,
  LogOut,
  Plus,
  MoreHorizontal,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notification-context';
import { useState, useCallback, useEffect } from 'react';

// ─── Navigation items ────────────────────────────────────────

const navItems = [
  { href: '/', icon: Home, label: 'For You', badge: null },
  { href: '/search', icon: Search, label: 'Search', badge: null },
  { href: '/news', icon: Newspaper, label: 'Civic News', badge: null },
  { href: '/labs', icon: Landmark, label: 'Legislation', badge: null },
  { href: '/debates', icon: MessageSquare, label: 'Debates', badge: null },
  { href: '/notifications', icon: Bell, label: 'Notifications', badge: '__NOTIF__' },
];

const secondaryItems = [
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/saved', icon: Bookmark, label: 'Saved' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

const adminItems = [
  { href: '/admin', icon: ShieldAlert, label: 'Trust & Safety' },
  { href: '/appeals', icon: Scale, label: 'Appeals' },
];

// ─── Desktop Sidebar ─────────────────────────────────────────

interface SidebarProps {
  onCompose?: () => void;
}

export function Sidebar({ onCompose }: SidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, isCreator, logout } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <aside className="hidden lg:flex flex-col w-[240px] h-screen sticky top-0 border-r border-border-subtle bg-bg-alt">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border-subtle">
        <div className="w-10 h-10 rounded-xl bg-civic flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text-primary tracking-tight">
            Civic Social
          </h1>
          <p className="text-xs text-text-muted">
            Discourse Platform
          </p>
        </div>
      </div>

      {/* Compose button */}
      {onCompose && (
        <div className="px-4 pt-5">
          <button
            onClick={onCompose}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
          >
            <PenSquare className="w-4 h-4" />
            New Post
          </button>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/' && pathname === '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface-elevated text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <item.icon
                className={clsx(
                  'w-5 h-5',
                  isActive ? 'text-text-primary' : 'text-text-muted',
                )}
              />
              <span>{item.label}</span>
              {(() => {
                const badgeValue = item.badge === '__NOTIF__'
                  ? (unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null)
                  : item.badge;
                return badgeValue ? (
                  <span
                    className={clsx(
                      'ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                      item.badge === '__NOTIF__'
                        ? 'bg-danger/15 text-danger-light'
                        : badgeValue === 'LIVE'
                          ? 'bg-danger/15 text-danger-light'
                          : 'bg-civic-muted text-civic-light',
                    )}
                  >
                    {badgeValue}
                  </span>
                ) : null;
              })()}
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3">
          <p className="text-xs font-semibold text-text-muted">
            Account
          </p>
        </div>

        {secondaryItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface-elevated text-text-primary font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <item.icon className={clsx('w-5 h-5', isActive ? 'text-text-primary' : 'text-text-muted')} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {(isAdmin || isCreator) && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-text-muted">
                Admin
              </p>
            </div>
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-surface-elevated text-text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer: user account */}
      <div className="p-4 border-t border-border-subtle space-y-1">
        {isAuthenticated && user ? (
          <Link
            href="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors duration-150 cursor-pointer"
          >
            {(user.avatarUrl || user.avatar) ? (
              <img
                src={(user.avatarUrl || user.avatar) as string}
                alt={user.displayName}
                className="w-9 h-9 rounded-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  const parent = el.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-9 h-9 rounded-full bg-civic-muted flex items-center justify-center text-civic-light text-sm font-semibold';
                    fallback.textContent = user.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
                    parent.replaceChild(fallback, el);
                  }
                }}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-civic-muted flex items-center justify-center text-civic-light text-sm font-semibold">
                {user.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
          </Link>
        ) : (
          <Link href="/login" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors">
            <div className="w-9 h-9 rounded-full bg-surface-active flex items-center justify-center text-text-muted"><User className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-civic-light">Sign In</span>
          </Link>
        )}

        {isAuthenticated && (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-danger-light hover:bg-danger/5 transition-colors duration-150"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// Mobile Bottom Tab Bar (5 tabs + More sheet + Compose FAB)
// ═══════════════════════════════════════════════════════════════

interface MobileNavProps {
  onCompose?: () => void;
}

export function MobileNav({ onCompose }: MobileNavProps) {
  const pathname = usePathname();
  const { isAuthenticated, isAdmin, isCreator, user, logout } = useAuth();
  const { unreadCount: mobileUnreadCount } = useNotifications();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close "More" sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  // Lock body scroll when More sheet is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [moreOpen]);

  const handleToggleMore = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  const handleCloseMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

  // Bottom tab items (4 primary + More)
  const tabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/news', icon: Newspaper, label: 'News' },
    { href: '/notifications', icon: Bell, label: 'Alerts', badge: true },
    { href: isAuthenticated ? '/profile' : '/login', icon: User, label: isAuthenticated ? 'Profile' : 'Sign In' },
  ];

  // Items shown in the "More" sheet
  const moreItems = [
    { href: '/debates', icon: MessageSquare, label: 'Debates', desc: 'Structured live debate rooms' },
    { href: '/labs', icon: Landmark, label: 'Legislation', desc: 'Track bills and policy' },
    { href: '/search', icon: Search, label: 'Search', desc: 'Find posts, people, and topics' },
    { href: '/saved', icon: Bookmark, label: 'Saved', desc: 'Your bookmarked posts' },
    { href: '/settings', icon: Settings, label: 'Settings', desc: 'Account and preferences' },
  ];

  // Check if any "More" route is currently active
  const moreRoutePaths = moreItems.map((m) => m.href);
  const isMoreRouteActive = moreRoutePaths.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')),
  );

  return (
    <>
      {/* Floating Compose Button */}
      {onCompose && (
        <button
          onClick={onCompose}
          className="lg:hidden fixed right-4 z-[60] w-14 h-14 bg-civic text-white rounded-2xl flex items-center justify-center shadow-md hover:bg-civic-dark transition-colors duration-150"
          style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
          aria-label="New Post"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* ── More Sheet Overlay ── */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={handleCloseMore}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-bg rounded-t-2xl border-t border-border-subtle pb-safe animate-slide-up shadow-2xl">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-civic-light" />
                <span className="text-sm font-semibold text-text-primary">More</span>
              </div>
              <button
                onClick={handleCloseMore}
                className="p-2 -mr-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag indicator */}
            <div className="flex justify-center -mt-1 mb-1">
              <div className="w-10 h-1 rounded-full bg-surface-active" />
            </div>

            {/* Navigation items */}
            <nav className="px-3 pb-3 space-y-0.5">
              {moreItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href + '/'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleCloseMore}
                    className={clsx(
                      'flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors duration-150',
                      isActive
                        ? 'bg-surface-elevated text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      isActive ? 'bg-surface-hover' : 'bg-surface-elevated',
                    )}>
                      <item.icon className={clsx(
                        'w-5 h-5',
                        isActive ? 'text-text-primary' : 'text-text-muted',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx(
                        'text-sm font-medium',
                        isActive ? 'text-civic-light font-semibold' : 'text-text-primary',
                      )}>
                        {item.label}
                      </p>
                      <p className="text-xs text-text-muted truncate">{item.desc}</p>
                    </div>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-civic shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Admin links */}
            {(isAdmin || isCreator) && (
              <div className="px-3 pb-3">
                <div className="border-t border-border-subtle pt-2">
                  <p className="text-xs font-semibold text-text-muted px-4 py-1.5">
                    Admin
                  </p>
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleCloseMore}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-colors"
                    >
                      <item.icon className="w-5 h-5 text-text-muted" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Sign out */}
            {isAuthenticated && (
              <div className="px-3 pb-4">
                <div className="border-t border-border-subtle pt-2">
                  <button
                    onClick={() => {
                      handleCloseMore();
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger-light hover:bg-danger/5 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Tab Bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-alt/90 backdrop-blur-2xl border-t border-border-subtle pb-safe">
        <div className="flex items-center justify-around px-1 pt-1.5 pb-1">
          {tabs.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === '/' && pathname === '/') ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors duration-150 relative min-w-[52px]',
                  isActive ? 'text-text-primary' : 'text-text-muted',
                )}
              >
                <div className="relative">
                  <item.icon
                    className="w-[22px] h-[22px]"
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {item.badge && mobileUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-danger text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {mobileUnreadCount > 99 ? '99+' : mobileUnreadCount}
                    </span>
                  )}
                </div>
                <span className={clsx('text-xs font-medium', isActive && 'font-semibold')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={handleToggleMore}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors duration-150 relative min-w-[52px]',
              moreOpen || isMoreRouteActive
                ? 'text-civic-light'
                : 'text-text-muted',
            )}
          >
            <div className="relative">
              <MoreHorizontal
                className="w-[22px] h-[22px]"
                strokeWidth={moreOpen || isMoreRouteActive ? 2.2 : 1.8}
              />
            </div>
            <span className={clsx('text-xs font-medium', (moreOpen || isMoreRouteActive) && 'font-semibold')}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
