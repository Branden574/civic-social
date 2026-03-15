'use client';

import { useState } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import Link from 'next/link';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  RefreshCcw,
  Flag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Data ───────────────────────────────────────────────────

interface SourceEntry {
  name: string;
  type: string;
  trust: number;
}

interface SourceTier {
  tier: string;
  label: string;
  description: string;
  badgeColor: string;
  badgeText: string;
  icon: typeof CheckCircle2;
  sources: SourceEntry[];
}

const SOURCE_TIERS: SourceTier[] = [
  {
    tier: '1',
    label: 'Highest Trust',
    description:
      'Wire services and public broadcasters with decades-long track records, editorial firewalls, and international reach.',
    badgeColor: 'bg-positive/15 text-positive-light border-positive/20',
    badgeText: 'Tier 1',
    icon: CheckCircle2,
    sources: [
      { name: 'Associated Press (AP)', type: 'Wire Service', trust: 97 },
      { name: 'Reuters', type: 'Wire Service', trust: 96 },
      { name: 'BBC News', type: 'Public Broadcaster', trust: 94 },
      { name: 'NPR', type: 'Public Radio', trust: 93 },
    ],
  },
  {
    tier: '2',
    label: 'High Trust',
    description:
      'Major newspapers and publications with strong editorial standards, fact-checking departments, and corrections policies.',
    badgeColor: 'bg-info/15 text-info-light border-info/20',
    badgeText: 'Tier 2',
    icon: CheckCircle2,
    sources: [
      { name: 'The New York Times', type: 'Newspaper', trust: 90 },
      { name: 'The Washington Post', type: 'Newspaper', trust: 89 },
      { name: 'The Wall Street Journal', type: 'Newspaper', trust: 89 },
      { name: 'The Economist', type: 'Magazine', trust: 91 },
    ],
  },
  {
    tier: '3',
    label: 'Moderate Trust',
    description:
      'Named, established outlets with editorial standards and public accountability. May have noticeable perspective but still maintains factual standards.',
    badgeColor: 'bg-warning/15 text-warning-light border-warning/20',
    badgeText: 'Tier 3',
    icon: AlertTriangle,
    sources: [
      { name: 'Named outlets with editorial boards', type: 'Various', trust: 72 },
      { name: 'Regional papers with corrections policies', type: 'Regional', trust: 70 },
      { name: 'Specialty publications with expertise', type: 'Specialty', trust: 74 },
    ],
  },
];

const NOT_PERMITTED = [
  'Anonymous pages or accounts with no editorial accountability',
  'Satire or parody presented as legitimate news',
  'State-controlled propaganda outlets',
  'Sources with repeated, uncorrected factual errors',
  'AI-generated "news" sites with no human editorial oversight',
];

// ─── Component ──────────────────────────────────────────────

export default function SourceTransparencyPage() {
  const [expandedTier, setExpandedTier] = useState<string | null>('1');
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-5 sm:px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-civic-subtle flex items-center justify-center">
                <Shield className="w-5 h-5 text-civic-light" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Source Transparency
                </h1>
                <p className="text-xs text-text-muted">
                  How we evaluate and tier news sources
                </p>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-6 space-y-8">
            {/* ── Our News Criteria ── */}
            <section className="animate-fade-in">
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-civic-light" />
                Our News Criteria
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Civic Social curates its news feed using a multi-factor trust
                  evaluation. Sources are selected based on editorial
                  independence, factual accuracy track record, corrections
                  policy, transparency of ownership, and adherence to
                  journalistic ethics standards. We do not filter by political
                  leaning — both conservative and progressive outlets appear when
                  they meet our factual accuracy threshold.
                </p>
              </div>
            </section>

            {/* ── Source Tier List ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '80ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-positive-light" />
                Source Tier List
              </h2>
              <div className="space-y-3">
                {SOURCE_TIERS.map((tier, i) => {
                  const isExpanded = expandedTier === tier.tier;
                  return (
                    <div
                      key={tier.tier}
                      className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden"
                      style={{
                        animationDelay: `${(i + 1) * 80}ms`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedTier(isExpanded ? null : tier.tier)
                        }
                        className="w-full px-5 py-4 flex items-center gap-3 hover:bg-surface-hover/50 transition-colors"
                      >
                        <span
                          className={clsx(
                            'text-xs font-bold px-2 py-1 rounded-xl border shrink-0',
                            tier.badgeColor,
                          )}
                        >
                          {tier.badgeText}
                        </span>
                        <div className="flex-1 text-left">
                          <span className="text-sm font-semibold text-text-primary">
                            {tier.label}
                          </span>
                          <p className="text-xs text-text-muted mt-0.5">
                            {tier.description}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 animate-fade-in">
                          <div className="space-y-2">
                            {tier.sources.map((source) => (
                              <div
                                key={source.name}
                                className="flex items-center gap-3 px-3 py-2.5 bg-surface rounded-xl border border-border-subtle"
                              >
                                <tier.icon
                                  className={clsx(
                                    'w-4 h-4 shrink-0',
                                    tier.tier === '1'
                                      ? 'text-positive-light'
                                      : tier.tier === '2'
                                        ? 'text-info-light'
                                        : 'text-warning-light',
                                  )}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-text-primary">
                                    {source.name}
                                  </span>
                                  <span className="text-xs text-text-muted ml-2">
                                    {source.type}
                                  </span>
                                </div>
                                <span
                                  className={clsx(
                                    'text-xs font-mono font-bold px-2 py-0.5 rounded-md',
                                    source.trust >= 90
                                      ? 'bg-positive/10 text-positive-light'
                                      : source.trust >= 80
                                        ? 'bg-info/10 text-info-light'
                                        : 'bg-warning/10 text-warning-light',
                                  )}
                                >
                                  {source.trust}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Not Permitted */}
                <div
                  className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-danger/20 overflow-hidden"
                  style={{
                    animationDelay: '320ms',
                    animationFillMode: 'forwards',
                  }}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="w-4 h-4 text-danger-light" />
                      <span className="text-sm font-semibold text-danger-light">
                        Not Permitted
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {NOT_PERMITTED.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm text-text-secondary"
                        >
                          <span className="text-danger-light mt-1 shrink-0">
                            ×
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* ── How Trust Scores Work ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '160ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-civic-light" />
                How Trust Scores Work
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Each source receives a Trust Score from 0–100 based on
                  factual accuracy, correction frequency, editorial independence,
                  and transparency. Scores are updated quarterly.
                </p>
                {/* Example bar */}
                <div className="space-y-3">
                  {[
                    {
                      label: 'Factual Accuracy',
                      value: 92,
                      color: 'bg-positive',
                    },
                    {
                      label: 'Correction Policy',
                      value: 88,
                      color: 'bg-info',
                    },
                    {
                      label: 'Editorial Independence',
                      value: 85,
                      color: 'bg-civic',
                    },
                    {
                      label: 'Ownership Transparency',
                      value: 78,
                      color: 'bg-warning',
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center gap-3">
                      <span className="text-xs text-text-muted w-40 shrink-0 truncate">
                        {metric.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-colors duration-700',
                            metric.color,
                          )}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-text-muted w-10 text-right">
                        {metric.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Review Process ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '240ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-civic-light" />
                Review Process
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  Sources are reviewed on a quarterly cycle. Our review process
                  includes:
                </p>
                <div className="space-y-3">
                  {[
                    {
                      step: '1',
                      text: 'Automated fact-check cross-referencing against known databases',
                    },
                    {
                      step: '2',
                      text: 'Community reports and flagged inaccuracies are compiled',
                    },
                    {
                      step: '3',
                      text: 'Independent editorial board reviews borderline sources',
                    },
                    {
                      step: '4',
                      text: 'Updated tier placements and trust scores are published transparently',
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-civic-subtle flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-civic-light">
                          {item.step}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed pt-0.5">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Report a Source ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '320ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Flag className="w-4 h-4 text-warning-light" />
                Report a Source
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  Think a source is rated too high or too low? Help us keep our
                  tier list accurate by reporting it for review.
                </p>
                <button
                  onClick={() => setReportOpen(!reportOpen)}
                  className="flex items-center gap-2 px-4 py-3 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  Report a Source for Review
                </button>
                {reportOpen && (
                  <div className="mt-4 p-4 bg-surface rounded-xl border border-border-subtle animate-fade-in">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-text-muted mb-1 block">
                          Source Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Example News Network"
                          className="w-full bg-surface-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-text-muted mb-1 block">
                          Reason
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Describe why this source should be reviewed..."
                          className="w-full bg-surface-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 resize-none"
                        />
                      </div>
                      <button className="px-4 py-2 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors">
                        Submit Report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Footer Link ── */}
            <div className="flex justify-center pt-2 pb-4">
              <Link
                href="/news"
                className="flex items-center gap-2 text-sm font-semibold text-civic-light hover:underline transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Browse Civic News
              </Link>
            </div>
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
