'use client';

import { useState } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import Link from 'next/link';
import {
  Shield,
  CheckCircle2,
  Quote,
  Heart,
  BadgeCheck,
  Users,
  Activity,
  Lightbulb,
  AlertTriangle,
  Lock,
  ArrowLeft,
  TrendingUp,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';
import { LandingNav } from '@/components/landing/landing-nav';

// ─── Data ───────────────────────────────────────────────────

interface CredibilityFactor {
  label: string;
  weight: string;
  weightNum: number;
  description: string;
  icon: typeof Shield;
  color: string;
  barColor: string;
  exampleScore: number;
}

const FACTORS: CredibilityFactor[] = [
  {
    label: 'Verified Identity',
    weight: '10%',
    weightNum: 10,
    description:
      'Optionally verify your identity to earn a trust boost. This includes email verification, ID validation, or professional credential checks.',
    icon: BadgeCheck,
    color: 'text-info-light',
    barColor: 'bg-info',
    exampleScore: 0.85,
  },
  {
    label: 'Citation Quality',
    weight: '25%',
    weightNum: 25,
    description:
      'Using credible, verifiable sources in your posts. Higher trust scores are given to peer-reviewed journals, established news outlets, and primary sources.',
    icon: Quote,
    color: 'text-warning-light',
    barColor: 'bg-warning',
    exampleScore: 0.72,
  },
  {
    label: 'Civil Engagement',
    weight: '25%',
    weightNum: 25,
    description:
      'Your history of constructive, respectful discourse. The system analyzes tone, language patterns, and whether you engage substantively rather than with personal attacks.',
    icon: Heart,
    color: 'text-positive-light',
    barColor: 'bg-positive',
    exampleScore: 0.9,
  },
  {
    label: 'Report Accuracy',
    weight: '15%',
    weightNum: 15,
    description:
      'How accurately and fairly you report content. False or frivolous reports lower this score, while legitimate reports that are upheld raise it.',
    icon: Shield,
    color: 'text-civic-light',
    barColor: 'bg-civic',
    exampleScore: 0.78,
  },
  {
    label: 'Cross-Party Engagement',
    weight: '15%',
    weightNum: 15,
    description:
      'Engaging constructively with perspectives different from your own. Users who only interact within echo chambers score lower here.',
    icon: Users,
    color: 'text-ideology-center',
    barColor: 'bg-ideology-center',
    exampleScore: 0.65,
  },
  {
    label: 'Behavioral Consistency',
    weight: '10%',
    weightNum: 10,
    description:
      'Steady, non-manipulative patterns over time. Sudden behavioral changes, coordinated inauthentic behavior, or bot-like patterns lower this score.',
    icon: Activity,
    color: 'text-text-secondary',
    barColor: 'bg-text-secondary',
    exampleScore: 0.88,
  },
];

interface Tip {
  title: string;
  description: string;
  icon: typeof Shield;
  color: string;
}

const TIPS: Tip[] = [
  {
    title: 'Cite credible sources',
    description:
      'Link to established outlets, academic papers, or primary documents. Avoid anonymous blogs or unverifiable claims.',
    icon: Quote,
    color: 'text-warning-light',
  },
  {
    title: 'Engage across perspectives',
    description:
      'Respond thoughtfully to posts from people with different views. Ask genuine questions and acknowledge valid points.',
    icon: Users,
    color: 'text-civic-light',
  },
  {
    title: 'Keep it civil',
    description:
      'Critique ideas, not people. Avoid sarcasm, personal attacks, and inflammatory language — even when you disagree strongly.',
    icon: Heart,
    color: 'text-positive-light',
  },
  {
    title: 'Verify your identity',
    description:
      'Complete email verification at minimum. Professional or ID verification provides an additional credibility boost.',
    icon: BadgeCheck,
    color: 'text-info-light',
  },
  {
    title: 'Report accurately',
    description:
      'Only report content that genuinely violates guidelines. Frivolous or weaponized reports lower your own credibility.',
    icon: Shield,
    color: 'text-danger-light',
  },
  {
    title: 'Be consistent',
    description:
      'Maintain steady engagement patterns. Sudden bursts of activity or dramatic behavior shifts trigger anti-manipulation checks.',
    icon: Activity,
    color: 'text-text-secondary',
  },
];

// ─── Public view (logged-out) ────────────────────────────────

function PublicCredibilityPage() {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');` }} />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-black to-[#0d0818] z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#7b39fc]/5 rounded-full blur-[120px] z-0" />

      <div className="relative z-10">
        <LandingNav />

        <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 space-y-12">
          {/* Hero */}
          <section className="text-center">
            <div className="inline-flex items-center gap-2 bg-[#7b39fc]/10 border border-[#7b39fc]/20 rounded-full px-4 py-1.5 mb-6">
              <Shield className="w-3.5 h-3.5 text-[#7b39fc]" />
              <span className="text-xs font-semibold text-[#7b39fc]" style={{ fontFamily: 'Manrope, sans-serif' }}>Transparent scoring · No black boxes</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              How Credibility Works
            </h1>
            <p className="text-white/60 max-w-[540px] mx-auto text-sm leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Your Credibility Score measures how trustworthy and constructive your contributions are.
              It ranges from 0 to 100, is calculated from six factors, and has nothing to do with your political views.
            </p>
          </section>

          {/* Factors */}
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <TrendingUp className="w-4 h-4 text-[#7b39fc]" />
              How it is calculated
            </h2>
            <div className="space-y-3">
              {FACTORS.map((factor) => {
                const isExpanded = expandedFactor === factor.label;
                return (
                  <div
                    key={factor.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFactor(isExpanded ? null : factor.label)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                    >
                      <factor.icon className={clsx('w-5 h-5 shrink-0', factor.color)} />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {factor.label}
                          </span>
                          <span className="text-xs font-bold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full">
                            {factor.weight}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full', factor.barColor)}
                              style={{ width: `${Math.round(factor.exampleScore * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-white/40 w-10 text-right">
                            {Math.round(factor.exampleScore * 100)}%
                          </span>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-0">
                        <p className="text-sm text-white/55 leading-relaxed pl-9" style={{ fontFamily: 'Manrope, sans-serif' }}>
                          {factor.description}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* What it is NOT */}
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <XCircle className="w-4 h-4 text-red-400" />
              What credibility is NOT
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              {[
                { label: 'Not a partisan score', detail: 'Your political views carry zero weight. Left, right, and center users all achieve high scores equally by engaging honestly and citing well.' },
                { label: 'Not a popularity metric', detail: 'Follower count and likes do not raise your credibility. A low-follower expert citing primary sources outranks viral low-quality content.' },
                { label: 'Not a punishment system', detail: 'The score rewards good behavior — it does not punish dissent. How you disagree is what matters, not whether you disagree.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                    <p className="text-xs text-white/50 leading-relaxed mt-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10">
              <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Start building your credibility
              </h2>
              <p className="text-white/55 text-sm mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Sign up and begin earning your score through honest, civil discourse.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-[#7b39fc] text-white font-semibold px-7 py-3 rounded-xl hover:bg-[#6a2de0] transition-colors shadow-xl shadow-[#7b39fc]/30"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Get Started Free
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </div>

        <footer className="border-t border-white/10 py-8 px-6">
          <div className="max-w-[1163px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Civic Social v0.2.0</span>
            </div>
            <p>No rage amplification · No echo chambers · No ad tracking</p>
            <div className="flex gap-4">
              <Link href="/how-it-works" className="hover:text-white/60 transition-colors">How it Works</Link>
              <Link href="/safety" className="hover:text-white/60 transition-colors">Safety</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Authenticated view ──────────────────────────────────────

function AuthenticatedCredibilityPage() {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

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
                  How Credibility Works
                </h1>
                <p className="text-xs text-text-muted">
                  Transparent scoring · No black boxes
                </p>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-6 space-y-8">
            {/* ── Section 1: What is a Credibility Score? ── */}
            <section className="animate-fade-in">
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-civic-light" />
                What is a Credibility Score?
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Your Credibility Score is a composite measure of how
                  trustworthy and constructive your contributions are on Civic
                  Social. It ranges from 0 to 100 and is calculated from six
                  distinct factors — none of which involve your political views.
                  The score helps the community identify reliable voices and
                  helps the algorithm surface high-quality discourse. It is
                  always transparent: you can see exactly how each factor
                  contributes to your score.
                </p>
              </div>
            </section>

            {/* ── Section 2: How It's Calculated ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '80ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-civic-light" />
                How It&apos;s Calculated
              </h2>
              <div className="space-y-3">
                {FACTORS.map((factor, i) => {
                  const isExpanded = expandedFactor === factor.label;
                  return (
                    <div
                      key={factor.label}
                      className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden transition-colors"
                      style={{
                        animationDelay: `${(i + 1) * 80}ms`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedFactor(isExpanded ? null : factor.label)
                        }
                        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-surface-hover/50 transition-colors"
                      >
                        <factor.icon
                          className={clsx('w-5 h-5 shrink-0', factor.color)}
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-text-primary">
                              {factor.label}
                            </span>
                            <span className="text-xs font-bold text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full">
                              {factor.weight}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface-active rounded-full overflow-hidden">
                              <div
                                className={clsx(
                                  'h-full rounded-full transition-colors duration-700',
                                  factor.barColor,
                                )}
                                style={{
                                  width: `${Math.round(factor.exampleScore * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono text-text-muted w-10 text-right">
                              {Math.round(factor.exampleScore * 100)}%
                            </span>
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-0 animate-fade-in">
                          <p className="text-sm text-text-secondary leading-relaxed pl-9">
                            {factor.description}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Section 3: Improvement Tips ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '160ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-warning-light" />
                Improvement Tips
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIPS.map((tip, i) => (
                  <div
                    key={tip.title}
                    className="feed-item animate-fade-in opacity-0 bg-surface-elevated rounded-xl border border-border-subtle p-4 hover:bg-surface-hover/50 transition-colors"
                    style={{
                      animationDelay: `${(i + 1) * 60}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <tip.icon
                        className={clsx('w-4 h-4 shrink-0', tip.color)}
                      />
                      <h3 className="text-sm font-semibold text-text-primary">
                        {tip.title}
                      </h3>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Section 4: What Credibility Is NOT ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '240ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-danger-light" />
                What Credibility Is NOT
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5 space-y-4">
                {[
                  {
                    label: 'Not a partisan score',
                    detail:
                      'Your political views have zero weight. Left, right, and center users achieve high scores equally when they engage honestly and cite well.',
                  },
                  {
                    label: 'Not a popularity metric',
                    detail:
                      'Having many followers or likes does not increase credibility. A low-follower expert citing primary sources outranks viral low-quality content.',
                  },
                  {
                    label: 'Not a punishment system',
                    detail:
                      'The score exists to reward good behavior, not punish dissent. Disagreeing is healthy — how you disagree is what matters.',
                  },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="feed-item animate-fade-in opacity-0 flex items-start gap-3"
                    style={{
                      animationDelay: `${(i + 1) * 60}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 text-danger-light shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {item.label}
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Section 5: Anti-Gaming Measures ── */}
            <section
              className="animate-fade-in"
              style={{ animationDelay: '320ms' }}
            >
              <h2 className="text-base font-bold text-text-primary mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-text-secondary" />
                Anti-Gaming Measures
              </h2>
              <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Civic Social employs multiple layers of protection against
                  score manipulation. These include behavioral anomaly detection,
                  coordinated inauthentic behavior analysis, sudden pattern
                  shift monitoring, and cross-referencing engagement graphs.
                  Artificially inflating your score (e.g., through coordinated
                  upvoting or sock puppet accounts) triggers automatic
                  investigation and can result in score penalties or suspension.
                  The specific thresholds and models are not disclosed to prevent
                  reverse-engineering.
                </p>
              </div>
            </section>

            {/* ── Footer Link ── */}
            <div className="flex justify-center pt-2 pb-4">
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-semibold text-civic-light hover:underline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Profile
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

// ─── Entry point ─────────────────────────────────────────────

export default function CredibilityPage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <PublicCredibilityPage />;
  return <AuthenticatedCredibilityPage />;
}
