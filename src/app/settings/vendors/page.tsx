'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

interface Vendor {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
}

export default function VendorSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', logoUrl: '', accentColor: '#0066CC' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && userRole !== 'admin') router.push('/dashboard');
  }, [status, userRole, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchVendors();
  }, [status]);

  const fetchVendors = async () => {
    const res = await fetch('/api/vendors');
    if (res.ok) setVendors(await res.json());
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        const res = await fetch(`/api/vendors/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: '', logoUrl: '', accentColor: '#0066CC' });
      fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name,
      logoUrl: vendor.logoUrl || '',
      accentColor: vendor.accentColor || '#0066CC',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor?')) return;
    await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
    fetchVendors();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vendor Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage vendor logos and accent colors</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ name: '', logoUrl: '', accentColor: '#0066CC' });
              setShowForm(true);
            }}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Add Vendor
          </button>
        </div>

        {/* Vendor Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Color</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vendor Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Logo URL</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Accent Color</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div
                      className="w-8 h-8 rounded-full border border-slate-200"
                      style={{ backgroundColor: vendor.accentColor || '#94a3b8' }}
                    />
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-500 truncate max-w-[200px]">
                    {vendor.logoUrl || '—'}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500 font-mono">
                    {vendor.accentColor || '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleEdit(vendor)}
                      className="text-xs text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    No vendors yet. Run /api/seed to create defaults, or add manually.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {editingId ? 'Edit Vendor' : 'Add Vendor'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g., ADP"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Logo URL <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Accent Color</label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="#0066CC"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setError('');
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
