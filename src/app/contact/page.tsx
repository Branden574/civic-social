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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject) {
      setError('Please select a subject.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-bg overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg via-bg-alt to-bg z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-civic/5 rounded-full blur-[120px] z-0" />

      <div className="relative z-10">
        <LandingNav />

        {/* Hero */}
        <section className="max-w-[1163px] mx-auto px-6 pt-16 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-civic-muted border border-civic/20 rounded-full px-4 py-1.5 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-civic-light" />
            <span className="text-xs font-semibold text-civic-light">Get in touch</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold text-text-primary mb-6 leading-tight">
            Contact Us
          </h1>
          <p className="text-lg text-text-muted max-w-[500px] mx-auto leading-relaxed">
            Questions, bug reports, partnership inquiries, or feedback — we read everything and respond.
          </p>
        </section>

        {/* Form + sidebar */}
        <section className="max-w-[1163px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

            {/* Contact form */}
            <div className="lg:col-span-3">
              {sent ? (
                <div className="flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-positive/20 bg-positive/5 min-h-[400px]">
                  <CheckCircle2 className="w-16 h-16 text-positive mb-4" />
                  <h2 className="text-2xl font-bold text-text-primary mb-2">
                    Message sent
                  </h2>
                  <p className="text-text-muted text-sm">
                    We will get back to you within 24–48 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-2xl border border-border bg-surface">
                  <h2 className="text-lg font-bold text-text-primary mb-6">
                    Send us a message
                  </h2>

                  {error && (
                    <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-danger-light shrink-0" />
                      <span className="text-sm text-danger-light">{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-civic/50 focus:ring-1 focus:ring-civic/20 transition-colors"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-civic/50 focus:ring-1 focus:ring-civic/20 transition-colors"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Subject
                    </label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-civic/50 focus:ring-1 focus:ring-civic/20 transition-colors"
                    >
                      <option value="" className="bg-bg">Select a subject</option>
                      {SUBJECTS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-bg">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Message
                    </label>
                    <textarea
                      required
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      rows={6}
                      className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-civic/50 focus:ring-1 focus:ring-civic/20 transition-colors resize-none"
                      placeholder="Tell us what is on your mind..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-civic text-white font-semibold py-3.5 rounded-xl hover:bg-civic-dark transition-colors shadow-lg shadow-civic/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            {/* Sidebar info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-civic" />
                  <h3 className="text-sm font-bold text-text-primary">Response Time</h3>
                </div>
                <p className="text-sm text-text-muted">
                  We respond to all messages within 24–48 hours on business days.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3 mb-2">
                  <Github className="w-5 h-5 text-text-secondary" />
                  <h3 className="text-sm font-bold text-text-primary">Open Source</h3>
                </div>
                <p className="text-sm text-text-muted mb-3">
                  Found a bug? Open an issue directly on GitHub for the fastest response.
                </p>
                <a
                  href="https://github.com/Branden574/civic-social"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-civic-light hover:underline"
                >
                  View on GitHub <ChevronRight className="w-3 h-3" />
                </a>
              </div>

              {/* FAQ */}
              <div className="p-6 rounded-2xl border border-border bg-surface">
                <h3 className="text-sm font-bold text-text-primary mb-4">
                  Common Questions
                </h3>
                <div className="space-y-5">
                  {FAQ.map((item) => (
                    <div key={item.q}>
                      <p className="text-xs font-semibold text-text-secondary mb-1 leading-snug">
                        {item.q}
                      </p>
                      <p className="text-xs text-text-muted leading-relaxed">
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
        <footer className="border-t border-border-subtle py-8 px-6">
          <div className="max-w-[1163px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Civic Social v0.2.0</span>
            </div>
            <p>No rage amplification · No echo chambers · No ad tracking</p>
            <div className="flex gap-4">
              <Link href="/how-it-works" className="hover:text-text-secondary transition-colors">How it Works</Link>
              <Link href="/safety" className="hover:text-text-secondary transition-colors">Safety</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
