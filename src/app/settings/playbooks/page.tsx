'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { CellStatus } from '@/types';

interface PlaybookRule {
  id: string;
  vendorName: string;
  name: string;
  conditionType: string;
  conditionValue: string;
  conditionField: string;
  actionType: string;
  actionValue: string;
  examples: string | null;
  confidence: string;
  enabled: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
}

const CONDITION_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regex' },
];

const CONDITION_FIELDS = [
  { value: 'label', label: 'Row Label' },
  { value: 'section', label: 'Section Name' },
  { value: 'display', label: 'Cell Display Value' },
];

const ACTION_TYPES = [
  { value: 'set_status', label: 'Set Status' },
  { value: 'add_note', label: 'Add Note' },
];

const STATUS_OPTIONS: { value: CellStatus; label: string }[] = [
  { value: 'included', label: 'Included' },
  { value: 'included_in_bundle', label: 'Included in bundle' },
  { value: 'not_included', label: 'Not included' },
  { value: 'tbc', label: 'To be confirmed' },
  { value: 'na', label: 'N/A' },
];

const EMPTY_FORM = {
  vendorName: '',
  name: '',
  conditionType: 'contains',
  conditionValue: '',
  conditionField: 'label',
  actionType: 'set_status',
  actionValue: '',
  confidence: 'sure',
  statusValue: 'included' as CellStatus,
  noteValue: '',
};

export default function PlaybooksSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState<PlaybookRule[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterVendor, setFilterVendor] = useState('');

  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && userRole !== 'admin') router.push('/dashboard');
  }, [status, userRole, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRules();
      fetchVendors();
    }
  }, [status]);

  const fetchRules = async () => {
    const res = await fetch('/api/playbooks');
    if (res.ok) setRules(await res.json());
    setLoading(false);
  };

  const fetchVendors = async () => {
    const res = await fetch('/api/vendors');
    if (res.ok) setVendors(await res.json());
  };

  const buildActionValue = (): string => {
    if (form.actionType === 'set_status') {
      return JSON.stringify({ status: form.statusValue });
    }
    if (form.actionType === 'add_note') {
      return JSON.stringify({ note: form.noteValue });
    }
    return '{}';
  };

  const parseActionValue = (actionType: string, actionValue: string) => {
    try {
      const parsed = JSON.parse(actionValue);
      if (actionType === 'set_status') return { statusValue: parsed.status || 'included', noteValue: '' };
      if (actionType === 'add_note') return { statusValue: 'included' as CellStatus, noteValue: parsed.note || '' };
    } catch {
      // ignore
    }
    return { statusValue: 'included' as CellStatus, noteValue: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const actionValue = buildActionValue();

    try {
      if (editingId) {
        const res = await fetch(`/api/playbooks/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorName: form.vendorName,
            name: form.name,
            conditionType: form.conditionType,
            conditionValue: form.conditionValue,
            conditionField: form.conditionField,
            actionType: form.actionType,
            actionValue,
            confidence: form.confidence,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch('/api/playbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorName: form.vendorName,
            name: form.name,
            conditionType: form.conditionType,
            conditionValue: form.conditionValue,
            conditionField: form.conditionField,
            actionType: form.actionType,
            actionValue,
            confidence: form.confidence,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: PlaybookRule) => {
    const { statusValue, noteValue } = parseActionValue(rule.actionType, rule.actionValue);
    setEditingId(rule.id);
    setForm({
      vendorName: rule.vendorName,
      name: rule.name,
      conditionType: rule.conditionType,
      conditionValue: rule.conditionValue,
      conditionField: rule.conditionField,
      actionType: rule.actionType,
      actionValue: rule.actionValue,
      confidence: rule.confidence,
      statusValue,
      noteValue,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this playbook rule?')) return;
    await fetch(`/api/playbooks/${id}`, { method: 'DELETE' });
    fetchRules();
  };

  const handleToggleEnabled = async (rule: PlaybookRule) => {
    await fetch(`/api/playbooks/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    fetchRules();
  };

  const formatActionDisplay = (actionType: string, actionValue: string): string => {
    try {
      const parsed = JSON.parse(actionValue);
      if (actionType === 'set_status') {
        const status = parsed.status as string;
        const label = STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
        return `Set status: ${label}`;
      }
      if (actionType === 'add_note') {
        return `Add note: "${parsed.note}"`;
      }
    } catch {
      // ignore
    }
    return actionType;
  };

  const filteredRules = filterVendor
    ? rules.filter((r) => r.vendorName === filterVendor)
    : rules;

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
            <h1 className="text-2xl font-bold text-slate-900">Vendor Playbooks</h1>
            <p className="text-sm text-slate-500 mt-1">
              Rules that automatically apply corrections to future analyses
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="bg-outsail-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-outsail-navy transition"
          >
            + Add Rule
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <select
            value={filterVendor}
            onChange={(e) => setFilterVendor(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
          >
            <option value="">All Vendors</option>
            <option value="*">Global Rules (*)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Rules Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Action</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Enabled</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">V</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {rule.vendorName === '*' ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Global</span>
                    ) : (
                      rule.vendorName
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{rule.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span className="text-xs text-slate-400">{rule.conditionField}</span>{' '}
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {rule.conditionType === 'regex' ? '~' : ''}
                      {rule.conditionValue}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {formatActionDisplay(rule.actionType, rule.actionValue)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        rule.enabled ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          rule.enabled ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">v{rule.version}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-xs text-outsail-blue hover:text-outsail-blue-dark mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                    {rules.length === 0
                      ? 'No playbook rules yet. Create one to start applying corrections automatically.'
                      : 'No rules match the selected filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {editingId ? 'Edit Rule' : 'Add Playbook Rule'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Vendor */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                  <select
                    value={form.vendorName}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                    required
                  >
                    <option value="">Select vendor...</option>
                    <option value="*">Global (all vendors)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                    placeholder='e.g., "Classify Training as Implementation"'
                    required
                  />
                </div>

                {/* Condition */}
                <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Condition</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Match Field</label>
                      <select
                        value={form.conditionField}
                        onChange={(e) => setForm({ ...form, conditionField: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                      >
                        {CONDITION_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Match Type</label>
                      <select
                        value={form.conditionType}
                        onChange={(e) => setForm({ ...form, conditionType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                      >
                        {CONDITION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Match Value</label>
                    <input
                      type="text"
                      value={form.conditionValue}
                      onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                      placeholder={form.conditionType === 'regex' ? 'e.g., training|onboard' : 'e.g., Training'}
                      required
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="bg-slate-50 p-3 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Action</p>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Action Type</label>
                    <select
                      value={form.actionType}
                      onChange={(e) => setForm({ ...form, actionType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                    >
                      {ACTION_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>

                  {form.actionType === 'set_status' && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Status</label>
                      <select
                        value={form.statusValue}
                        onChange={(e) => setForm({ ...form, statusValue: e.target.value as CellStatus })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.actionType === 'add_note' && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Note Text</label>
                      <input
                        type="text"
                        value={form.noteValue}
                        onChange={(e) => setForm({ ...form, noteValue: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
                        placeholder="e.g., Typically bundled with Core HR"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Confidence */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confidence</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="radio"
                        name="confidence"
                        value="sure"
                        checked={form.confidence === 'sure'}
                        onChange={(e) => setForm({ ...form, confidence: e.target.value })}
                        className="accent-outsail-blue"
                      />
                      Sure
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="radio"
                        name="confidence"
                        value="maybe"
                        checked={form.confidence === 'maybe'}
                        onChange={(e) => setForm({ ...form, confidence: e.target.value })}
                        className="accent-outsail-blue"
                      />
                      Maybe
                    </label>
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
                    className="flex-1 bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
