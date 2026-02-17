'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Mail, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await forgotPassword(email);

    if (result.success) {
      setIsSuccess(true);
    } else {
      setError(result.error || 'Something went wrong. Please try again.');
    }

    setIsLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-fade-in">
        {/* ── Back link ── */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        {/* ── Logo header ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-civic flex items-center justify-center mb-4 shadow-glow">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Reset your password
          </h1>
          <p className="text-sm text-text-muted mt-1 text-center max-w-xs">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-surface-elevated rounded-2xl border border-border-subtle p-6 sm:p-8 shadow-lg">
          {isSuccess ? (
            /* ── Success state ── */
            <div className="text-center py-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-positive" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-2">
                Check your email
              </h2>
              <p className="text-sm text-text-secondary mb-1">
                We&apos;ve sent a password reset link to
              </p>
              <p className="text-sm font-semibold text-text-primary mb-6">
                {email}
              </p>
              <p className="text-xs text-text-muted mb-6">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail('');
                  }}
                  className="text-civic-light hover:underline font-medium"
                >
                  try again
                </button>
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
              >
                <Mail className="w-4 h-4" />
                Return to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2.5 p-3 mb-5 bg-danger/10 border border-danger/20 rounded-lg animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-danger-light shrink-0" />
                  <p className="text-sm text-danger-light">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/50 focus:border-civic transition-all"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all',
                    isLoading
                      ? 'bg-civic/60 text-white/70 cursor-not-allowed'
                      : 'bg-civic text-white hover:bg-civic-dark hover:shadow-glow active:scale-[0.98]',
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <p className="text-sm text-text-muted text-center mt-6">
          Remember your password?{' '}
          <Link
            href="/login"
            className="text-civic-light font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
