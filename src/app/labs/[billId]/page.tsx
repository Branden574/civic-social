'use client';

// ═══════════════════════════════════════════════════════════════
// DEPRECATED: Old bill detail route (/labs/[billId])
// ═══════════════════════════════════════════════════════════════
//
// This page exists for backward compatibility only.
// It shows a prominent warning that the data is from the old mock
// system and directs users to the canonical bill pages.
//
// The canonical route is: /legislation/US/119/s/2103
// ═══════════════════════════════════════════════════════════════

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import {
  ArrowLeft,
  Landmark,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export default function LegacyBillDetailPage() {
  const params = useParams();
  const billId = params.billId as string;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* ── Back link ── */}
          <Link
            href="/labs"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Legislative Tracker
          </Link>

          {/* ── Deprecation Warning ── */}
          <div className="bg-warning/5 border border-warning/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-warning-light shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-text-primary">
                  This Bill Page Uses Legacy Data
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  The URL <code className="text-xs font-mono bg-surface-active px-1.5 py-0.5 rounded">/labs/{billId}</code> uses
                  the old mock data system which may display incorrect bill titles and information.
                  Bill data has been migrated to use official Congress.gov data with canonical identifiers.
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  <strong>Important:</strong> Bill numbers repeat across congressional sessions.
                  Without a session identifier, we cannot guarantee the correct bill is shown.
                </p>
              </div>
            </div>
          </div>

          {/* ── Direction to new system ── */}
          <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-civic-light" />
              <h3 className="text-sm font-semibold text-text-primary">
                Use the New Canonical Bill Pages
              </h3>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Bills are now identified by canonical keys that include the country, congress session,
              bill type, and number. For example:
            </p>

            <div className="grid gap-2">
              <Link
                href="/legislation/US/119/hr/1"
                className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-civic-light transition-colors">
                    H.R. 1 — 119th Congress
                  </p>
                  <p className="text-xs text-text-muted font-mono">
                    /legislation/US/119/hr/1
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-civic-light transition-colors" />
              </Link>

              <Link
                href="/legislation/US/119/s/5"
                className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-civic-light transition-colors">
                    S. 5 — 119th Congress
                  </p>
                  <p className="text-xs text-text-muted font-mono">
                    /legislation/US/119/s/5
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-civic-light transition-colors" />
              </Link>

              <Link
                href="/legislation/US/119/hr/22"
                className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-civic-light transition-colors">
                    H.R. 22 — 119th Congress
                  </p>
                  <p className="text-xs text-text-muted font-mono">
                    /legislation/US/119/hr/22
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-civic-light transition-colors" />
              </Link>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/labs"
                className="inline-flex items-center gap-2 px-4 py-2 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
              >
                <Landmark className="w-4 h-4" />
                Go to Live Tracker
              </Link>
              <a
                href="https://www.congress.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-text-secondary text-sm font-medium rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Congress.gov
              </a>
            </div>
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
