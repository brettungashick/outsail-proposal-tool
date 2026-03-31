'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';

export default function AccountSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string })?.role;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo upload state (admin only)
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Fetch current logo
  useEffect(() => {
    fetch('/api/settings/logo')
      .then((res) => res.json())
      .then((data) => setLogoUrl(data.logoUrl))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Failed to change password');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError('');
    setLogoSuccess('');
    setLogoUploading(true);

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/settings/logo', {
        method: 'POST',
        body: formData,
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Upload failed');
      }
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLogoUrl(data.logoUrl);
      setLogoSuccess('Logo updated! Refresh the page to see it everywhere.');
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (status === 'loading') {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your account and security</p>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-outsail-blue/20 flex items-center justify-center text-lg font-semibold text-outsail-blue-dark">
                {(session?.user?.name || 'U').charAt(0)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{session?.user?.name}</p>
                <p className="text-sm text-slate-500">{session?.user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* App Logo (Admin only) */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">App Logo</h2>
            <p className="text-sm text-slate-500 mb-4">
              Upload your company logo. It will appear in the sidebar, login page, and all public-facing pages.
            </p>

            {logoError && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {logoError}
                <button onClick={() => setLogoError('')} className="ml-2 text-red-500 hover:text-red-700">x</button>
              </div>
            )}
            {logoSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
                {logoSuccess}
                <button onClick={() => setLogoSuccess('')} className="ml-2 text-green-500 hover:text-green-700">x</button>
              </div>
            )}

            <div className="flex items-center gap-6">
              {/* Current logo preview */}
              <div className="w-40 h-16 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden">
                {logoUrl ? (
                  <Image src={logoUrl} alt="Current logo" width={140} height={50} style={{ objectFit: 'contain' }} />
                ) : (
                  <span className="text-sm text-slate-400">No logo uploaded</span>
                )}
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
                >
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="text-xs text-slate-400 mt-1">PNG, JPEG, SVG, or WebP. Max 2MB.</p>
              </div>
            </div>
          </div>
        )}

        {/* Change Password */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Change Password</h2>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
              <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">x</button>
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
              {success}
              <button onClick={() => setSuccess('')} className="ml-2 text-green-500 hover:text-green-700">x</button>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                placeholder="Repeat new password"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-outsail-blue-dark text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </Sidebar>
  );
}
