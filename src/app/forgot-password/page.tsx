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
    <div className="min-h-screen bg-bg flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-[420px] animate-fade-in">
        {/* ── Back link ── */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        {/* ── Logo header ── */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-civic flex items-center justify-center mb-5">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Forgot Password
          </h1>
          <p className="text-sm text-text-muted mt-2 text-center max-w-[300px]">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-surface-elevated rounded-2xl p-7 sm:p-8">
          {isSuccess ? (
            /* ── Success state ── */
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-positive" />
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
              <p className="text-xs text-text-muted mb-7">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail('');
                  }}
                  className="text-civic-light hover:text-civic font-medium transition-colors"
                >
                  try again
                </button>
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
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
                <div className="flex items-center gap-3 p-3.5 mb-6 bg-danger/10 rounded-xl animate-fade-in">
                  <AlertCircle className="w-4.5 h-4.5 text-danger-light shrink-0" />
                  <p className="text-sm text-danger-light">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-xl transition-colors',
                    isLoading
                      ? 'bg-civic/60 text-white/70 cursor-not-allowed'
                      : 'bg-civic text-white hover:bg-civic-dark',
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
        <p className="text-sm text-text-muted text-center mt-8">
          Remember your password?{' '}
          <Link
            href="/login"
            className="text-civic-light font-semibold hover:text-civic transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
