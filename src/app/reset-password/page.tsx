'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-[420px] animate-fade-in">
        {/* ── Logo header ── */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-civic flex items-center justify-center mb-5">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Create New Password
          </h1>
          <p className="text-sm text-text-muted mt-2 text-center max-w-[300px]">
            Choose a strong password for your account.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-surface-elevated rounded-2xl p-7 sm:p-8">
          {success ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-positive" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-2">
                Password Updated
              </h2>
              <p className="text-sm text-text-secondary mb-7">
                Your password has been updated successfully.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-3 p-3.5 mb-6 bg-danger/10 rounded-xl animate-fade-in">
                  <AlertCircle className="w-4.5 h-4.5 text-danger-light shrink-0" />
                  <p className="text-sm text-danger-light">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      disabled={!token || loading}
                      className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors pr-12 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    required
                    disabled={!token || loading}
                    className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!token || loading}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-xl transition-colors',
                    loading || !token
                      ? 'bg-civic/60 text-white/70 cursor-not-allowed'
                      : 'bg-civic text-white hover:bg-civic-dark',
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <p className="text-sm text-text-muted text-center mt-8">
          <Link
            href="/login"
            className="text-civic-light font-semibold hover:text-civic transition-colors"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-civic flex items-center justify-center">
          <Shield className="w-7 h-7 text-white" />
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
