'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';

interface VendorOption {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
}

interface VendorEnriched {
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
}

interface BenchmarkResult {
  projectId: string;
  projectName: string;
  clientName: string;
  advisorName: string;
  date: string;
  vendors: VendorEnriched[];
  headcount: number | null;
  year1Totals: Record<string, string>;
  total3yr: Record<string, string>;
}

export default function BenchmarksPage() {
  const { status } = useSession();
  const router = useRouter();
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [vendorFilterText, setVendorFilterText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [minHeadcount, setMinHeadcount] = useState('');
  const [maxHeadcount, setMaxHeadcount] = useState('');
  const [months, setMonths] = useState('12');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Load vendor options from Vendor Management
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/vendors')
        .then((res) => res.json())
        .then((data) => setVendorOptions(data))
        .catch(() => {});
    }
  }, [status]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVendorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedVendorIds.length > 0) params.set('vendorIds', selectedVendorIds.join(','));
    if (minHeadcount) params.set('minHeadcount', minHeadcount);
    if (maxHeadcount) params.set('maxHeadcount', maxHeadcount);
    params.set('months', months);

    const res = await fetch(`/api/benchmarks?${params.toString()}`);
    if (res.ok) {
      setResults(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === 'authenticated') handleSearch();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVendor = (id: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const selectedVendorNames = vendorOptions
    .filter((v) => selectedVendorIds.includes(v.id))
    .map((v) => v.name);

  const filteredOptions = vendorOptions.filter((v) =>
    v.name.toLowerCase().includes(vendorFilterText.toLowerCase())
  );

  if (status === 'loading') {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Benchmarks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search comparable quotes across all projects for benchmarking
          </p>
        </div>

        {/* Search filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Vendor multi-select dropdown */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor(s)</label>
              <button
                type="button"
                onClick={() => setVendorDropdownOpen(!vendorDropdownOpen)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-left bg-white focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none flex items-center justify-between"
              >
                <span className={selectedVendorNames.length ? 'text-slate-900' : 'text-slate-400'}>
                  {selectedVendorNames.length
                    ? selectedVendorNames.length <= 2
                      ? selectedVendorNames.join(', ')
                      : `${selectedVendorNames.length} vendors selected`
                    : 'All vendors'}
                </span>
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {vendorDropdownOpen && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      value={vendorFilterText}
                      onChange={(e) => setVendorFilterText(e.target.value)}
                      placeholder="Filter vendors..."
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-outsail-blue outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-48">
                    {filteredOptions.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-slate-400 text-center">No vendors found</div>
                    ) : (
                      filteredOptions.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVendor(v.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 transition text-left"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            selectedVendorIds.includes(v.id)
                              ? 'bg-outsail-blue-dark border-outsail-blue-dark'
                              : 'border-slate-300'
                          }`}>
                            {selectedVendorIds.includes(v.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          {v.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.logoUrl}
                              alt={v.name}
                              className="w-5 h-5 object-contain flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: v.accentColor || '#94a3b8' }}
                            >
                              <span className="text-white text-[9px] font-bold">{v.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="text-slate-700">{v.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedVendorIds.length > 0 && (
                    <div className="p-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedVendorIds([])}
                        className="text-xs text-outsail-blue hover:text-outsail-blue-dark"
                      >
                        Clear selection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Headcount</label>
              <input
                type="number"
                value={minHeadcount}
                onChange={(e) => setMinHeadcount(e.target.value)}
                placeholder="e.g., 50"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Headcount</label>
              <input
                type="number"
                value={maxHeadcount}
                onChange={(e) => setMaxHeadcount(e.target.value)}
                placeholder="e.g., 200"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recency</label>
              <select
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-outsail-blue outline-none"
              >
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
                <option value="24">Last 2 years</option>
                <option value="120">All time</option>
              </select>
            </div>
          </div>
          {/* Selected vendor chips */}
          {selectedVendorIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {vendorOptions
                .filter((v) => selectedVendorIds.includes(v.id))
                .map((v) => (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                    style={{
                      backgroundColor: v.accentColor ? `${v.accentColor}15` : '#f1f5f9',
                      borderColor: v.accentColor ? `${v.accentColor}40` : '#e2e8f0',
                      color: v.accentColor || '#475569',
                    }}
                  >
                    {v.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                    )}
                    {v.name}
                    <button
                      type="button"
                      onClick={() => toggleVendor(v.id)}
                      className="hover:opacity-70"
                    >
                      &times;
                    </button>
                  </span>
                ))}
            </div>
          )}
          <div className="mt-4">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-outsail-blue-dark text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length === 0 && !loading ? (
          <div className="text-center py-16 text-slate-400">
            No matching benchmarks found. Try adjusting your filters.
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((r) => (
              <div
                key={r.projectId}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition cursor-pointer"
                onClick={() => router.push(`/projects/${r.projectId}/analysis`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{r.projectName}</h3>
                    <p className="text-sm text-slate-500">
                      Advisor: {r.advisorName} · {new Date(r.date).toLocaleDateString()}
                    </p>
                  </div>
                  {r.headcount && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {r.headcount} employees
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mb-3">
                  {r.vendors.map((v) => (
                    <span
                      key={v.name}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                      style={{
                        backgroundColor: v.accentColor ? `${v.accentColor}15` : '#eef2ff',
                        borderColor: v.accentColor ? `${v.accentColor}40` : '#e0e7ff',
                        color: v.accentColor || '#4338ca',
                      }}
                    >
                      {v.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.logoUrl}
                          alt={v.name}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : v.accentColor ? (
                        <span
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: v.accentColor }}
                        />
                      ) : null}
                      {v.name}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Year 1</p>
                    <div className="flex gap-4">
                      {Object.entries(r.year1Totals).map(([vendor, total]) => (
                        <span key={vendor} className="text-slate-700">
                          <span className="text-slate-400">{vendor}:</span> {total}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">3-Year Total</p>
                    <div className="flex gap-4">
                      {Object.entries(r.total3yr).map(([vendor, total]) => (
                        <span key={vendor} className="text-slate-700">
                          <span className="text-slate-400">{vendor}:</span> {total}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
