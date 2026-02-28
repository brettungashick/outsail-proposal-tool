'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [tokenData, setTokenData] = useState<{ email: string; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid link');
        return res.json();
      })
      .then((data) => {
        setTokenData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('This reset link is invalid or has expired.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Image src="/outsail-logo.svg" alt="OutSail" width={180} height={46} priority />
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Password Reset!</h2>
            <p className="text-sm text-slate-500 mb-6">Your password has been updated. Sign in with your new password.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-outsail-blue-dark text-white py-2.5 rounded-lg font-medium hover:bg-outsail-navy transition"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <Image src="/outsail-logo.svg" alt="OutSail" width={180} height={46} priority />
            </div>
            {tokenData ? (
              <>
                <h2 className="text-xl font-bold text-slate-900">Reset Your Password</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choose a new password for <span className="font-medium">{tokenData.email}</span>
                </p>
              </>
            ) : (
              <p className="text-red-600 text-sm">{error}</p>
            )}
          </div>

          {tokenData && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none transition"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none transition"
                  placeholder="Repeat your password"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-outsail-blue-dark text-white py-2.5 rounded-lg font-medium hover:bg-outsail-navy transition disabled:opacity-50"
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
