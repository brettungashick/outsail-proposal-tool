'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: string;
  inviteStatus: string;
  createdAt: string;
  _count: { projects: number };
}

export default function TeamSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string; email: string; emailSent: boolean } | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const userRole = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && userRole !== 'admin') router.push('/dashboard');
  }, [status, userRole, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchMembers();
  }, [status]);

  const fetchMembers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    setInviteResult(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInviteResult({ inviteUrl: data.inviteUrl, email: data.email, emailSent: data.emailSent });
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setConfirmDelete(null);
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
      setConfirmDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (status === 'loading' || loading) {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
            <p className="text-sm text-slate-500 mt-1">Invite and manage OutSail advisors</p>
          </div>
          <button
            onClick={() => {
              setShowInvite(true);
              setInviteForm({ name: '', email: '' });
              setInviteResult(null);
              setError('');
            }}
            className="bg-outsail-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-outsail-navy transition"
          >
            + Invite Advisor
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">x</button>
          </div>
        )}

        {/* Team Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Projects</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-outsail-blue/20 flex items-center justify-center text-sm font-semibold text-outsail-blue-dark">
                        {m.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500">{m.email}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === 'admin' ? 'bg-outsail-navy text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.inviteStatus === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-50 text-green-700'
                    }`}>
                      {m.inviteStatus === 'pending' ? 'Invite Pending' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500">{m._count.projects}</td>
                  <td className="px-6 py-3 text-right">
                    {m.id === userId ? (
                      <span className="text-xs text-slate-400">You</span>
                    ) : confirmDelete === m.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-red-600">Remove?</span>
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invite Modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              {inviteResult ? (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    {inviteResult.emailSent ? 'Invite Email Sent!' : 'Invite Created!'}
                  </h2>
                  {inviteResult.emailSent ? (
                    <p className="text-sm text-slate-500 mb-4">
                      An invitation email has been sent to <span className="font-medium">{inviteResult.email}</span>. You can also share this link directly:
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 mb-4">
                      Share this link with <span className="font-medium">{inviteResult.email}</span> so they can set up their password:
                    </p>
                  )}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-slate-700 font-mono break-all">{inviteResult.inviteUrl}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => copyToClipboard(inviteResult.inviteUrl)}
                      className="flex-1 bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        setShowInvite(false);
                        setInviteResult(null);
                      }}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Invite New Advisor</h2>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                        placeholder="e.g., Jane Smith"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                        placeholder="advisor@outsail.co"
                        required
                      />
                    </div>

                    {error && (
                      <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInvite(false);
                          setError('');
                        }}
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={inviting}
                        className="flex-1 bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
                      >
                        {inviting ? 'Inviting...' : 'Send Invite'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
