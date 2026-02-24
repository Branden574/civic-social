'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, MessageSquare, Github, ChevronRight, Send, CheckCircle2, Mail, AlertCircle } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';

const FAQ = [
  {
    q: 'How do I report a bug or technical issue?',
    a: 'Use the form and select "Bug Report". Include your browser, operating system, and the steps to reproduce the issue. We aim to respond within 24–48 hours.',
  },
  {
    q: 'Can I appeal a moderation decision?',
    a: 'Yes. Log in and go to Settings → Appeals. Every moderation action has a transparent appeals process with a clear timeline.',
  },
  {
    q: 'How do I request account deletion?',
    a: 'Go to Settings → Account → Delete Account inside the app. If you are locked out, use this form with the subject "Account Deletion Request" and include your registered email.',
  },
  {
    q: 'I want to partner or collaborate.',
    a: 'We welcome partnerships with civic organizations, news outlets, academic institutions, and research groups. Select "Partnership Inquiry" in the form.',
  },
];

const SUBJECTS = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feedback', label: 'General Feedback' },
  { value: 'account', label: 'Account Issue' },
  { value: 'moderation', label: 'Moderation Appeal' },
  { value: 'partnership', label: 'Partnership Inquiry' },
  { value: 'press', label: 'Press / Media' },
  { value: 'other', label: 'Other' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject) {
      setError('Please select a subject.');
      return;
    }
    setError('');
    // TODO: wire to real API endpoint
    setSent(true);
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');` }} />

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a14] via-black to-[#0a0f18] z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-sky-400/5 rounded-full blur-[120px] z-0" />

      <div className="relative z-10">
        <LandingNav />

        {/* Hero */}
        <section className="max-w-[1163px] mx-auto px-6 pt-16 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-sky-400/10 border border-sky-400/20 rounded-full px-4 py-1.5 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-sky-400" style={{ fontFamily: 'Manrope, sans-serif' }}>Get in touch</span>
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-[64px] font-bold text-white mb-6 leading-tight"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Contact Us
          </h1>
          <p className="text-lg text-white/60 max-w-[500px] mx-auto leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Questions, bug reports, partnership inquiries, or feedback — we read everything and respond.
          </p>
        </section>

        {/* Form + sidebar */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* Contact form */}
            <div className="lg:col-span-3">
              {sent ? (
                <div className="flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 min-h-[400px]">
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Message sent
                  </h2>
                  <p className="text-white/60 text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    We will get back to you within 24–48 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
                  <h2 className="text-lg font-bold text-white mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Send us a message
                  </h2>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-sm text-red-400" style={{ fontFamily: 'Manrope, sans-serif' }}>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7b39fc]/50 focus:ring-1 focus:ring-[#7b39fc]/20 transition-colors"
                        placeholder="Your name"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7b39fc]/50 focus:ring-1 focus:ring-[#7b39fc]/20 transition-colors"
                        placeholder="you@example.com"
                        style={{ fontFamily: 'Manrope, sans-serif' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Subject
                    </label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7b39fc]/50 focus:ring-1 focus:ring-[#7b39fc]/20 transition-colors"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      <option value="" className="bg-[#0a0a14]">Select a subject</option>
                      {SUBJECTS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-[#0a0a14]">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Message
                    </label>
                    <textarea
                      required
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      rows={6}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7b39fc]/50 focus:ring-1 focus:ring-[#7b39fc]/20 transition-colors resize-none"
                      placeholder="Tell us what is on your mind..."
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#7b39fc] text-white font-semibold py-3 rounded-xl hover:bg-[#6a2de0] transition-all shadow-lg shadow-[#7b39fc]/25"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    <Send className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>

            {/* Sidebar info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-[#7b39fc]" />
                  <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Response Time</h3>
                </div>
                <p className="text-sm text-white/50" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  We respond to all messages within 24–48 hours on business days.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-3 mb-2">
                  <Github className="w-5 h-5 text-white/60" />
                  <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>Open Source</h3>
                </div>
                <p className="text-sm text-white/50 mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Found a bug? Open an issue directly on GitHub for the fastest response.
                </p>
                <a
                  href="https://github.com/Branden574/civic-social"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7b39fc] hover:underline"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  View on GitHub <ChevronRight className="w-3 h-3" />
                </a>
              </div>

              {/* FAQ */}
              <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03]">
                <h3 className="text-sm font-bold text-white mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Common Questions
                </h3>
                <div className="space-y-5">
                  {FAQ.map((item) => (
                    <div key={item.q}>
                      <p className="text-xs font-semibold text-white/80 mb-1 leading-snug" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item.q}
                      </p>
                      <p className="text-xs text-white/40 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
              <Link href="/safety" className="hover:text-white/60 transition-colors">Safety</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
