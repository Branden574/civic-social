'use client';

import { useState } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import Link from 'next/link';
import {
  Scale,
  CheckCircle2,
  Clock,
  FileText,
  Send,
  MessageSquare,
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Data ───────────────────────────────────────────────────

interface Appeal {
  id: string;
  status: 'resolved' | 'pending' | 'rejected';
  contentSnippet: string;
  ruleViolated: string;
  actionTaken: string;
  resolution: string;
  submittedAt: Date;
  resolvedAt: Date | null;
}

const MOCK_APPEALS: Appeal[] = [
  {
    id: 'a1',
    status: 'resolved',
    contentSnippet:
      'Post discussing comparative healthcare policy between US and European systems, including cost analysis and outcome statistics...',
    ruleViolated: 'Flagged for potential misinformation (automated)',
    actionTaken: 'Post temporarily hidden pending review',
    resolution:
      'Appeal upheld. Post restored with a note that all cited statistics were verified against WHO and CMS data. Automated flag was a false positive due to cost figure formatting.',
    submittedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
];

interface ProcessStep {
  step: string;
  title: string;
  description: string;
  icon: typeof Send;
  color: string;
}

const PROCESS_STEPS: ProcessStep[] = [
  {
    step: '1',
    title: 'Submit',
    description:
      'File an appeal within 14 days of a moderation action. Provide context and any supporting evidence.',
    icon: Send,
    color: 'text-civic-light',
  },
  {
    step: '2',
    title: 'Review',
    description:
      'A human moderator (not the original reviewer) examines your appeal, the original content, and any sources cited.',
    icon: FileText,
    color: 'text-info-light',
  },
  {
    step: '3',
    title: 'Decision',
    description:
      'You receive a written decision within 72 hours. If the appeal is complex, it may be escalated to a panel.',
    icon: Scale,
    color: 'text-warning-light',
  },
  {
    step: '4',
    title: 'Resolution',
    description:
      'Content is restored if the appeal is upheld. If denied, a detailed explanation is provided with further escalation options.',
    icon: CheckCircle2,
    color: 'text-positive-light',
  },
];

const GUIDELINES = [
  {
    rule: 'Be factual',
    detail:
      'Claims should be supported by credible sources. Speculation should be clearly labeled.',
  },
  {
    rule: 'Be civil',
    detail:
      'Critique ideas, not people. No personal attacks, harassment, or threats.',
  },
  {
    rule: 'Be honest',
    detail:
      'No intentional misinformation, manipulated media, or misleading context.',
  },
  {
    rule: 'Be transparent',
    detail:
      'Disclose conflicts of interest, affiliations, and potential biases when relevant.',
  },
  {
    rule: 'Be constructive',
    detail:
      'Engage to inform and discuss, not to inflame or provoke.',
  },
];

// ─── Component ──────────────────────────────────────────────

export default function AppealsPage() {
  const [expandedAppeal, setExpandedAppeal] = useState<string | null>('a1');
  const [expandedGuidelines, setExpandedGuidelines] = useState(false);

  const resolvedCount = MOCK_APPEALS.filter(
    (a) => a.status === 'resolved',
  ).length;
  const pendingCount = MOCK_APPEALS.filter(
    (a) => a.status === 'pending',
  ).length;

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* ── Header ── */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-5 sm:px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-civic-subtle flex items-center justify-center">
                <Scale className="w-5 h-5 text-civic-light" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Content Appeals
                </h1>
                <p className="text-xs text-text-muted">
                  Fair review · Human decisions · Full transparency
                </p>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-6 space-y-8">
            {/* ── Stats Summary ── */}
            <div
              className="grid grid-cols-2 gap-3 animate-fade-in"
            >
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-positive-light" />
                  <span className="text-xs font-semibold text-text-muted">
                    Resolved
                  </span>
                </div>
                <p className="text-2xl font-bold text-positive-light">
                  {resolvedCount}
                </p>
              </div>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-warning-light" />
                  <span className="text-xs font-semibold text-text-muted">
                    Pending
                  </span>
                </div>
                <p className="text-2xl font-bold text-warning-light">
                  {pendingCount}
                </p>
              </div>
            </div>

            {/* ── Your Appeals ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '80ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-civic-light" />
                Your Appeals
              </h2>
              {MOCK_APPEALS.length === 0 ? (
                <div className="bg-surface-elevated rounded-xl border border-border-subtle p-8 text-center">
                  <Scale className="w-8 h-8 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    No appeals submitted yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {MOCK_APPEALS.map((appeal, i) => {
                    const isExpanded = expandedAppeal === appeal.id;
                    return (
                      <div
                        key={appeal.id}
                        className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden"
                        style={{
                          animationDelay: `${(i + 1) * 80}ms`,
                          animationFillMode: 'forwards',
                        }}
                      >
                        <button
                          onClick={() =>
                            setExpandedAppeal(isExpanded ? null : appeal.id)
                          }
                          className="w-full px-5 py-4 flex items-center gap-3 hover:bg-surface-hover/50 transition-colors"
                        >
                          {appeal.status === 'resolved' ? (
                            <CheckCircle2 className="w-5 h-5 text-positive-light shrink-0" />
                          ) : appeal.status === 'pending' ? (
                            <Clock className="w-5 h-5 text-warning-light shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-danger-light shrink-0" />
                          )}
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={clsx(
                                  'text-xs font-bold px-2 py-0.5 rounded-full',
                                  appeal.status === 'resolved'
                                    ? 'bg-positive/15 text-positive-light'
                                    : appeal.status === 'pending'
                                      ? 'bg-warning/15 text-warning-light'
                                      : 'bg-danger/15 text-danger-light',
                                )}
                              >
                                {appeal.status.charAt(0).toUpperCase() +
                                  appeal.status.slice(1)}
                              </span>
                              <span className="text-xs text-text-muted">
                                Submitted{' '}
                                {formatDistanceToNow(appeal.submittedAt, {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-text-secondary mt-1 truncate">
                              {appeal.contentSnippet}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 animate-fade-in">
                            <div className="space-y-4 pl-8">
                              {/* Content snippet */}
                              <div>
                                <p className="text-xs font-semibold text-text-muted mb-1">
                                  Original Content
                                </p>
                                <div className="bg-surface rounded-xl border border-border-subtle p-3">
                                  <p className="text-sm text-text-secondary leading-relaxed italic">
                                    &ldquo;{appeal.contentSnippet}&rdquo;
                                  </p>
                                </div>
                              </div>

                              {/* Rule violated */}
                              <div>
                                <p className="text-xs font-semibold text-text-muted mb-1">
                                  Rule Flagged
                                </p>
                                <p className="text-sm text-warning-light">
                                  {appeal.ruleViolated}
                                </p>
                              </div>

                              {/* Action taken */}
                              <div>
                                <p className="text-xs font-semibold text-text-muted mb-1">
                                  Action Taken
                                </p>
                                <p className="text-sm text-text-secondary">
                                  {appeal.actionTaken}
                                </p>
                              </div>

                              {/* Resolution */}
                              <div>
                                <p className="text-xs font-semibold text-text-muted mb-1">
                                  Resolution
                                </p>
                                <div className="bg-positive/5 border border-positive/15 rounded-xl p-3">
                                  <p className="text-sm text-positive-light leading-relaxed">
                                    {appeal.resolution}
                                  </p>
                                </div>
                              </div>

                              {/* Dates */}
                              <div className="flex items-center gap-4 text-xs text-text-muted">
                                <span>
                                  Submitted:{' '}
                                  {appeal.submittedAt.toLocaleDateString()}
                                </span>
                                {appeal.resolvedAt && (
                                  <span>
                                    Resolved:{' '}
                                    {appeal.resolvedAt.toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── How Appeals Work ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '160ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-civic-light" />
                How Appeals Work
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROCESS_STEPS.map((step, i) => (
                  <div
                    key={step.step}
                    className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-border-subtle p-4"
                    style={{
                      animationDelay: `${(i + 1) * 80}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-civic-subtle flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-civic-light">
                          {step.step}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <step.icon
                          className={clsx('w-4 h-4', step.color)}
                        />
                        <h3 className="text-sm font-semibold text-text-primary">
                          {step.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed pl-11">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Community Guidelines Summary ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '240ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-civic-light" />
                Community Guidelines Summary
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
                <button
                  onClick={() => setExpandedGuidelines(!expandedGuidelines)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
                >
                  <span className="text-sm font-medium text-text-secondary">
                    {expandedGuidelines ? 'Hide' : 'Show'} guideline summary
                  </span>
                  {expandedGuidelines ? (
                    <ChevronUp className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                </button>
                {expandedGuidelines && (
                  <div className="px-5 pb-5 animate-fade-in">
                    <div className="space-y-3">
                      {GUIDELINES.map((g, i) => (
                        <div
                          key={g.rule}
                          className="feed-item animate-fade-in opacity-0 flex items-start gap-3"
                          style={{
                            animationDelay: `${(i + 1) * 50}ms`,
                            animationFillMode: 'forwards',
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 text-civic-light shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {g.rule}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              {g.detail}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Start New Appeal ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '320ms' }}
            >
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 text-center">
                <Scale className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <h3 className="text-sm font-bold text-text-primary mb-1">
                  Start New Appeal
                </h3>
                <p className="text-xs text-text-secondary mb-4 max-w-sm mx-auto">
                  You can appeal any moderation action taken on your content.
                  Appeals are reviewed by a different moderator within 72 hours.
                </p>
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-active text-text-muted text-sm font-semibold rounded-xl cursor-not-allowed"
                  title="No pending moderation actions to appeal"
                >
                  <Scale className="w-4 h-4" />
                  No Pending Actions to Appeal
                </button>
                <p className="text-xs text-text-muted mt-2">
                  Appeals are available when a moderation action is taken on your
                  content.
                </p>
              </div>
            </section>

            {/* ── Footer Link ── */}
            <div className="flex justify-center pt-2 pb-4">
              <Link
                href="/settings"
                className="flex items-center gap-2 text-sm font-semibold text-civic-light hover:underline transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                Back to Settings
              </Link>
            </div>
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}
