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
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-border bg-bg-alt">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border-subtle">
        <div className="w-9 h-9 rounded-lg bg-civic flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-text-primary tracking-tight">
            Civic Social
          </h1>
          <p className="text-[11px] text-text-muted tracking-wide uppercase">
            Discourse Platform
          </p>
        </div>
      </div>

      {/* Compose button */}
      {onCompose && (
        <div className="px-3 pt-4">
          <button
            onClick={onCompose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-all duration-150 hover:shadow-glow active:scale-[0.97]"
          >
            <PenSquare className="w-4 h-4" />
            New Post
          </button>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/' && pathname === '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-civic/10 text-civic-light font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <div className="relative">
                <item.icon
                  className={clsx(
                    'w-[18px] h-[18px] transition-transform duration-150',
                    isActive ? 'text-civic-light scale-110' : 'group-hover:scale-105',
                  )}
                />
                {isActive && (
                  <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-civic animate-scale-in" />
                )}
              </div>
              <span>{item.label}</span>
              {(() => {
                const badgeValue = item.badge === '__NOTIF__'
                  ? (unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null)
                  : item.badge;
                return badgeValue ? (
                  <span
                    className={clsx(
                      'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center transition-all',
                      item.badge === '__NOTIF__'
                        ? 'bg-danger/20 text-danger-light'
                        : badgeValue === 'LIVE'
                          ? 'bg-danger/20 text-danger-light animate-pulse'
                          : 'bg-civic/20 text-civic-light',
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
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-civic/10 text-civic-light font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
              )}
            >
              <item.icon className={clsx('w-[18px] h-[18px]', isActive && 'text-civic-light')} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {(isAdmin || isCreator) && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-civic/10 text-civic-light font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer: user account */}
      <div className="p-4 border-t border-border-subtle space-y-2">
        {isAuthenticated && user ? (
          <Link
            href="/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-all duration-150 cursor-pointer active:scale-[0.97]"
          >
            <div className="w-9 h-9 rounded-full bg-civic/20 flex items-center justify-center text-civic-light text-sm font-semibold ring-2 ring-civic/10">
              {user.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user.displayName}</p>
              <p className="text-[11px] text-text-muted truncate">{user.email}</p>
            </div>
          </Link>
        ) : (
          <Link href="/login" className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-all active:scale-[0.97]">
            <div className="w-9 h-9 rounded-full bg-surface-active flex items-center justify-center text-text-muted"><User className="w-4 h-4" /></div>
            <span className="text-sm font-medium text-civic-light">Sign In</span>
          </Link>
        )}

        {isAuthenticated && (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-danger-light hover:bg-danger/5 transition-all duration-150"
          >
            <LogOut className="w-[18px] h-[18px]" />
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
          className="lg:hidden fixed right-4 z-[60] w-14 h-14 bg-civic text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-civic-dark transition-all duration-200 active:scale-90 animate-pulse-glow"
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
                      'flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-150 active:scale-[0.98]',
                      isActive
                        ? 'bg-civic/10 text-civic-light'
                        : 'text-text-secondary hover:bg-surface-hover active:bg-surface-active',
                    )}
                  >
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      isActive ? 'bg-civic/15' : 'bg-surface-elevated',
                    )}>
                      <item.icon className={clsx(
                        'w-5 h-5',
                        isActive ? 'text-civic-light' : 'text-text-muted',
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
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-4 py-1.5">
                    Admin
                  </p>
                  {adminItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleCloseMore}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-hover active:bg-surface-active transition-all"
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
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-danger-light hover:bg-danger/5 transition-all"
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
                  'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 relative min-w-[52px]',
                  isActive ? 'text-civic-light' : 'text-text-muted active:text-text-secondary',
                )}
              >
                <div className="relative">
                  <item.icon
                    className={clsx(
                      'w-[22px] h-[22px] transition-all duration-200',
                      isActive && 'scale-110',
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-civic animate-scale-in" />
                  )}
                  {item.badge && mobileUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-danger text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {mobileUnreadCount > 99 ? '99+' : mobileUnreadCount}
                    </span>
                  )}
                </div>
                <span className={clsx('text-[10px] font-medium', isActive && 'font-semibold')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            onClick={handleToggleMore}
            className={clsx(
              'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 relative min-w-[52px]',
              moreOpen || isMoreRouteActive
                ? 'text-civic-light'
                : 'text-text-muted active:text-text-secondary',
            )}
          >
            <div className="relative">
              <MoreHorizontal
                className={clsx(
                  'w-[22px] h-[22px] transition-all duration-200',
                  (moreOpen || isMoreRouteActive) && 'scale-110',
                )}
                strokeWidth={moreOpen || isMoreRouteActive ? 2.2 : 1.8}
              />
              {isMoreRouteActive && !moreOpen && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-civic animate-scale-in" />
              )}
            </div>
            <span className={clsx('text-[10px] font-medium', (moreOpen || isMoreRouteActive) && 'font-semibold')}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
