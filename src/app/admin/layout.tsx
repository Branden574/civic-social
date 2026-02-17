'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import {
  Shield,
  ShieldAlert,
  Scale,
  Landmark,
  Lock,
  LogOut,
  ChevronRight,
  Home,
  User,
  Clock,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';

// ─── Admin nav (role-based) ───────────────────────────────────

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: ShieldAlert },
  { href: '/admin/legislation', label: 'Legislation Sync', icon: Landmark },
  { href: '/appeals', label: 'Appeals', icon: Scale },
  { href: '/admin/guide', label: 'Guide', icon: Info },
] as const;

const ROLE_LABELS: Record<string, string> = {
  creator: 'Platform Creator',
  admin: 'Administrator',
  moderator: 'Moderator',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, isCreator, logout, isLoading } = useAuth();

  // Loading: minimal shell to avoid flash
  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="text-sm text-text-muted">Loading...</div>
        </main>
        <MobileNav />
      </div>
    );
  }

  // Not signed in
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center p-4">
          <div className="max-w-sm w-full text-center p-8 bg-surface-elevated rounded-2xl border border-border-subtle">
            <div className="w-14 h-14 rounded-2xl bg-civic/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-civic-light" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Sign In Required
            </h2>
            <p className="text-sm text-text-muted mb-6">
              You must be signed in to access the admin area.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors focus:outline-none focus:ring-2 focus:ring-civic focus:ring-offset-2 focus:ring-offset-bg"
            >
              Go to Sign In
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  // Not admin or creator
  if (!isCreator && !isAdmin) {
    return (
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <main className="flex-1 min-w-0 flex items-center justify-center p-4">
          <div className="max-w-sm w-full text-center p-8 bg-surface-elevated rounded-2xl border border-border-subtle">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-danger-light" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-text-muted mb-6">
              This area is restricted to platform administrators.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface text-text-secondary text-sm font-semibold rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-civic focus:ring-offset-2 focus:ring-offset-bg"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : 'Admin';
  const sessionStarted = user?.sessionStartedAt
    ? formatDistanceToNow(new Date(user.sessionStartedAt), { addSuffix: true })
    : null;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0" id="admin-main" aria-label="Admin area">
        {/* Admin strip: identity, role, session, sign out */}
        <header
          className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl border-b border-border-subtle"
          role="banner"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg bg-danger/10 flex items-center justify-center shrink-0"
                aria-hidden
              >
                <Shield className="w-5 h-5 text-danger-light" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-text-primary truncate">
                  Admin
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-civic/15 text-civic-light"
                    title={`Role: ${roleLabel}`}
                  >
                    {roleLabel}
                  </span>
                  {sessionStarted && (
                    <span
                      className="text-[10px] text-text-muted flex items-center gap-1"
                      title="Session started"
                    >
                      <Clock className="w-3 h-3" />
                      Session {sessionStarted}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-2 text-xs text-text-muted truncate max-w-[180px]">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user?.displayName}</span>
                <span className="text-text-muted/80 truncate">({user?.email})</span>
              </span>
              <Link
                href="/admin/guide"
                className="p-2 rounded-lg text-text-muted hover:text-civic-light hover:bg-surface-hover transition-colors"
                title="Admin guide"
                aria-label="Admin guide"
              >
                <Info className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-danger-light hover:bg-danger/5 rounded-lg border border-border-subtle hover:border-danger/20 transition-colors focus:outline-none focus:ring-2 focus:ring-danger/30"
                aria-label="Sign out of admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>

          {/* Sub-nav: Dashboard, Legislation Sync, Appeals */}
          <nav
            className="flex gap-0 px-4 sm:px-6 border-t border-border-subtle"
            aria-label="Admin sections"
          >
            {ADMIN_NAV.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                    isActive
                      ? 'text-civic-light border-civic'
                      : 'text-text-muted border-transparent hover:text-text-primary hover:border-border-subtle',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        {children}
      </main>
      <MobileNav />
    </div>
  );
}
