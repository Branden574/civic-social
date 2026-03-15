'use client';

import Link from 'next/link';
import { Shield, UserCheck, PenLine, TrendingUp, FileText, Users, ChevronRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';

const STEPS = [
  {
    number: '01',
    icon: UserCheck,
    title: 'Create your profile',
    desc: 'Sign up with your email, choose your country, and optionally declare your political affiliation. Your affiliation is never used to rank your content — only how you engage does.',
    color: 'text-civic-light',
    bg: 'bg-civic-subtle',
  },
  {
    number: '02',
    icon: PenLine,
    title: 'Post with sources',
    desc: 'Share your perspective on any political topic. Attach credible sources — peer-reviewed research, established news outlets, government documents — to strengthen your argument and your credibility score.',
    color: 'text-positive-light',
    bg: 'bg-positive/10',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Build credibility through civil discourse',
    desc: 'Your credibility score grows when you engage respectfully, cite quality sources, and interact across political perspectives. It has nothing to do with follower count or virality.',
    color: 'text-warning-light',
    bg: 'bg-warning/10',
  },
  {
    number: '04',
    icon: FileText,
    title: 'Track live legislation',
    desc: 'Follow real bills moving through Congress from introduction to vote. Get plain-language summaries and see community analysis ranked by credibility — not by who shouted loudest.',
    color: 'text-info-light',
    bg: 'bg-info/10',
  },
  {
    number: '05',
    icon: Users,
    title: 'Engage across the spectrum',
    desc: 'Civic Social surfaces perspectives from across the political spectrum — not just views that match your own. The algorithm actively rewards cross-party engagement and penalizes echo-chamber behavior.',
    color: 'text-danger-light',
    bg: 'bg-danger/10',
  },
];

const RANKING_FACTORS = [
  {
    label: 'Civility Score',
    value: '30%',
    desc: 'Tone, language quality, and respectfulness of your posts',
    color: 'bg-civic',
    text: 'text-civic-light',
  },
  {
    label: 'Source Quality',
    value: '25%',
    desc: 'Credibility and relevance of the sources you cite',
    color: 'bg-positive-light',
    text: 'text-positive-light',
  },
  {
    label: 'Cross-Party Engagement',
    value: '20%',
    desc: 'Constructive interaction with views different from your own',
    color: 'bg-warning-light',
    text: 'text-warning-light',
  },
  {
    label: 'Community Validation',
    value: '15%',
    desc: 'How other credible users respond to your contributions',
    color: 'bg-info-light',
    text: 'text-info-light',
  },
  {
    label: 'Behavioral Consistency',
    value: '10%',
    desc: 'Steady, authentic patterns of engagement over time',
    color: 'bg-danger-light',
    text: 'text-danger-light',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen bg-bg overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg-alt to-bg z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-civic/5 rounded-full blur-[120px] z-0" />

      <div className="relative z-10">
        <LandingNav />

        {/* Hero */}
        <section className="max-w-[1163px] mx-auto px-6 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-civic-subtle border border-civic-muted rounded-full px-4 py-1.5 mb-6">
            <Shield className="w-3.5 h-3.5 text-civic-light" />
            <span className="text-xs font-semibold text-civic-light font-sans">Built for honest civic discourse</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold text-text-primary mb-6 leading-tight font-sans">
            How Civic Social Works
          </h1>
          <p className="text-lg text-text-muted max-w-[600px] mx-auto leading-relaxed font-sans">
            A platform built from the ground up to reward quality, civility, and honest engagement —
            not outrage, virality, or echo chambers.
          </p>
        </section>

        {/* Steps */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <h2 className="text-2xl font-bold text-text-primary mb-8 font-sans">
            Getting started
          </h2>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="flex gap-5 p-6 rounded-2xl border border-border-subtle bg-surface hover:bg-surface-hover transition-colors"
              >
                <div className="shrink-0">
                  <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center`}>
                    <step.icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono font-bold text-text-muted">{step.number}</span>
                    <h3 className="text-base font-bold text-text-primary font-sans">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed font-sans">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ranking algorithm */}
        <section id="credibility" className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text-primary mb-4 font-sans">
              How Posts Are Ranked
            </h2>
            <p className="text-text-secondary max-w-[540px] mx-auto text-sm leading-relaxed font-sans">
              Our algorithm ranks content by quality and civility — not by what generates the most outrage or ad revenue.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RANKING_FACTORS.map((item) => (
              <div key={item.label} className="p-6 rounded-2xl border border-border-subtle bg-surface">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className={`text-2xl font-bold ${item.text}`}>{item.value}</span>
                </div>
                <h4 className="text-sm font-semibold text-text-primary mb-1.5 font-sans">
                  {item.label}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed font-sans">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* What the algorithm never does */}
          <div className="mt-8 p-6 rounded-2xl border border-border-subtle bg-surface">
            <h3 className="text-sm font-bold text-text-primary mb-4 font-sans">
              What our algorithm never does
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Prioritize content that triggers outrage',
                'Amplify posts based on follower count',
                'Show you only views that match your own',
                'Reward engagement bait or rage-bait',
                'Boost sponsored or promoted content',
                'Penalize users for their political views',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-danger/60 shrink-0" />
                  <span className="text-xs text-text-muted font-sans">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24 text-center">
          <div className="rounded-3xl border border-border-subtle bg-surface p-12">
            <h2 className="text-3xl font-bold text-text-primary mb-4 font-sans">
              Ready to join the conversation?
            </h2>
            <p className="text-text-secondary mb-8 text-sm font-sans">
              Create your account for free and start engaging with civic discourse that actually matters.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-civic text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-civic-dark transition-colors shadow-lg font-sans"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-subtle py-8 px-6">
          <div className="max-w-[1163px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted font-sans">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Civic Social v0.2.0</span>
            </div>
            <p>No rage amplification · No echo chambers · No ad tracking</p>
            <div className="flex gap-4">
              <Link href="/safety" className="hover:text-text-secondary transition-colors">Safety</Link>
              <Link href="/contact" className="hover:text-text-secondary transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
