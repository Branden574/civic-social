'use client';

import Link from 'next/link';
import {
  Shield,
  User,
  Lock,
  ChevronRight,
  Mail,
  Key,
  Scale,
  Landmark,
  ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';

const ROLES = [
  {
    role: 'creator',
    label: 'Platform Creator',
    description: 'Full platform control. Access to Trust & Safety, Legislation Sync, Appeals, and all admin features.',
    icon: ShieldAlert,
  },
  {
    role: 'admin',
    label: 'Administrator',
    description: 'Trust & Safety dashboard, Legislation Sync health, and Appeals. Same access as Creator for moderation and operations.',
    icon: Shield,
  },
  {
    role: 'moderator',
    label: 'Moderator',
    description: 'Content moderation and appeals review. Access to moderation queues and appeal decisions.',
    icon: Scale,
  },
];

export default function AdminGuidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-1">Admin Guide</h1>
        <p className="text-sm text-text-muted">
          Roles, access, and how to sign in as admin for development and production.
        </p>
      </div>

      {/* Roles */}
      <section className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <User className="w-4 h-4 text-civic-light" />
          Roles
        </h2>
        <div className="space-y-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.role}
                className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border-subtle"
              >
                <Icon className="w-5 h-5 text-civic-light shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{r.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{r.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dev / production login */}
      <section className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Lock className="w-4 h-4 text-civic-light" />
          Admin Login
        </h2>
        <p className="text-xs text-text-muted">
          In development and in production (until you integrate a real auth provider), admin access is determined by email.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-positive/5 border border-positive/15">
            <Mail className="w-5 h-5 text-positive-light shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Platform Creator (full admin)</p>
              <p className="text-xs text-text-muted mt-0.5">
                Email: <code className="px-1.5 py-0.5 rounded bg-surface text-civic-light font-mono text-xs">admin@civicsocial.com</code>
                {' '}— any password (min 8 characters). Use this for full platform control.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border-subtle">
            <Key className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Other roles</p>
              <p className="text-xs text-text-muted mt-0.5">
                Any email containing <code className="px-1 py-0.5 rounded bg-surface text-text-secondary font-mono text-xs">admin</code> → Administrator.
                Any email containing <code className="px-1 py-0.5 rounded bg-surface text-text-secondary font-mono text-xs">mod</code> → Moderator.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          For production: replace mock auth with your IdP (e.g. Auth0, Clerk, NextAuth) and map roles from your user store or JWT claims.
        </p>
      </section>

      {/* Quick links */}
      <section className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Quick Links
        </h2>
        <div className="grid gap-2">
          <Link
            href="/admin"
            className="flex items-center justify-between p-3 rounded-xl border border-border-subtle hover:bg-surface-hover hover:border-civic/30 transition-colors group"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <ShieldAlert className="w-4 h-4 text-civic-light" />
              Trust & Safety Dashboard
            </span>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light" />
          </Link>
          <Link
            href="/admin/legislation"
            className="flex items-center justify-between p-3 rounded-xl border border-border-subtle hover:bg-surface-hover hover:border-civic/30 transition-colors group"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Landmark className="w-4 h-4 text-civic-light" />
              Legislation Sync Health
            </span>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light" />
          </Link>
          <Link
            href="/appeals"
            className="flex items-center justify-between p-3 rounded-xl border border-border-subtle hover:bg-surface-hover hover:border-civic/30 transition-colors group"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Scale className="w-4 h-4 text-civic-light" />
              Appeals
            </span>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-civic-light" />
          </Link>
        </div>
      </section>

      <div className="h-12" />
    </div>
  );
}
