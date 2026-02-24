'use client';

import Link from 'next/link';
import { Shield, Lock, EyeOff, Ban, Heart, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';

const PILLARS = [
  {
    icon: Lock,
    title: 'Secure by Design',
    color: 'text-[#7b39fc]',
    bg: 'bg-[#7b39fc]/10',
    border: 'border-[#7b39fc]/20',
    items: [
      'Passwords hashed with PBKDF2 — never stored in plain text',
      'HTTPS enforced on every connection',
      'Rate limiting on all authentication endpoints to prevent brute force attacks',
      'Session tokens invalidated on logout and rotated regularly',
    ],
  },
  {
    icon: EyeOff,
    title: 'Privacy First',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    items: [
      'No advertising — zero ad trackers, ever',
      'Your data is never sold to third parties',
      'Political affiliation is optional and never shared without your explicit consent',
      'Anonymous browsing mode available in account settings',
    ],
  },
  {
    icon: Ban,
    title: 'No Rage Algorithms',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
    items: [
      'Content is ranked by civility and quality — not engagement bait',
      'Posts designed to trigger outrage are actively deprioritized',
      'Rage-bait detection is built directly into the ranking algorithm',
      'No infinite scroll engineered to maximize time-on-site at the cost of your wellbeing',
    ],
  },
  {
    icon: Heart,
    title: 'Civility-First Moderation',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
    items: [
      'AI-assisted civility scoring on every post before it appears in the feed',
      'Transparent community reporting with fair human review',
      'A clear appeals process for every moderation action',
      'Published community guidelines — no arbitrary or political enforcement',
    ],
  },
];

const VERIFICATION_LEVELS = [
  {
    level: 'Unverified',
    desc: 'Basic account — sign up and start posting immediately',
    color: 'text-white/50',
    dot: 'bg-white/20',
    badge: 'bg-white/5 border-white/10',
  },
  {
    level: 'Email Verified',
    desc: 'Confirmed active email address — low effort, meaningful trust boost',
    color: 'text-sky-400',
    dot: 'bg-sky-400',
    badge: 'bg-sky-400/10 border-sky-400/20',
  },
  {
    level: 'Citizen Verified',
    desc: 'Government-issued ID confirmed — shows you are who you say you are',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-400/10 border-emerald-400/20',
  },
  {
    level: 'Expert Verified',
    desc: 'Professional credentials confirmed — doctors, lawyers, academics, journalists',
    color: 'text-amber-400',
    dot: 'bg-amber-400',
    badge: 'bg-amber-400/10 border-amber-400/20',
  },
  {
    level: 'Official Verified',
    desc: 'Elected officials, government bodies, and accredited public institutions',
    color: 'text-[#7b39fc]',
    dot: 'bg-[#7b39fc]',
    badge: 'bg-[#7b39fc]/10 border-[#7b39fc]/20',
  },
];

export default function SafetyPage() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');` }} />

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-black to-[#0a140d] z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-400/5 rounded-full blur-[120px] z-0" />

      <div className="relative z-10">
        <LandingNav />

        {/* Hero */}
        <section className="max-w-[1163px] mx-auto px-6 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-4 py-1.5 mb-6">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400" style={{ fontFamily: 'Manrope, sans-serif' }}>Safety &amp; Privacy</span>
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-[64px] font-bold text-white mb-6 leading-tight"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Your Safety Is Not Optional
          </h1>
          <p className="text-lg text-white/60 max-w-[600px] mx-auto leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Civic Social treats privacy and safety as core requirements — not afterthoughts.
            Here is exactly what we do and will never do.
          </p>
        </section>

        {/* Pillars */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className={`p-6 rounded-2xl border ${pillar.border} bg-white/[0.03]`}
              >
                <div className={`w-10 h-10 ${pillar.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <pillar.icon className={`w-5 h-5 ${pillar.color}`} />
                </div>
                <h3 className="text-base font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {pillar.title}
                </h3>
                <ul className="space-y-2.5">
                  {pillar.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-white/55 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Verification Levels */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Verification Levels
            </h2>
            <p className="text-white/60 max-w-[500px] mx-auto text-sm leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Verification is always optional. Each level gives your voice greater trust and raises your credibility score — without ever requiring you to share more than you are comfortable with.
            </p>
          </div>
          <div className="space-y-3">
            {VERIFICATION_LEVELS.map((v, i) => (
              <div
                key={v.level}
                className={`flex items-start sm:items-center gap-4 p-4 rounded-xl border ${v.badge} bg-white/[0.02]`}
              >
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/30 shrink-0">
                  {i + 1}
                </div>
                <div className={`w-2 h-2 rounded-full ${v.dot} shrink-0 mt-1 sm:mt-0`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-semibold ${v.color}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {v.level}
                  </span>
                  <span className="text-sm text-white/40 ml-0 sm:ml-3 block sm:inline" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {v.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What we will never do */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                What We Will Never Do
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Sell your personal data to advertisers or data brokers',
                'Display ads or track you across the web',
                'Amplify outrage to increase time-on-platform',
                'Share your political affiliation without your consent',
                'Use shadow-banning or hidden suppression without transparency',
                'Allow coordinated inauthentic behavior or bot networks',
                'Discriminate against users based on their political viewpoint',
                'Change our privacy practices without clear notice to users',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-white/65" style={{ fontFamily: 'Manrope, sans-serif' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24 text-center">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12">
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Join a platform that respects you
            </h2>
            <p className="text-white/60 mb-8 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Your voice matters. So does your safety and your data.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#7b39fc] text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-[#6a2de0] transition-all shadow-xl shadow-[#7b39fc]/30"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8 px-6">
          <div className="max-w-[1163px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Civic Social v0.2.0</span>
            </div>
            <p>No rage amplification · No echo chambers · No ad tracking</p>
            <div className="flex gap-4">
              <Link href="/how-it-works" className="hover:text-white/60 transition-colors">How it Works</Link>
              <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
