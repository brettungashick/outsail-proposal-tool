'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';

interface BenchmarkResult {
  projectId: string;
  projectName: string;
  clientName: string;
  advisorName: string;
  date: string;
  vendors: string[];
  headcount: number | null;
  year1Totals: Record<string, string>;
  total3yr: Record<string, string>;
}

export default function BenchmarksPage() {
  const { status } = useSession();
  const router = useRouter();
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [minHeadcount, setMinHeadcount] = useState('');
  const [maxHeadcount, setMaxHeadcount] = useState('');
  const [months, setMonths] = useState('12');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const handleSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (vendorSearch.trim()) params.set('vendors', vendorSearch.trim());
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

  if (status === 'loading') {
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Benchmarks</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search comparable quotes across all projects for benchmarking
          </p>
        </div>

        {/* Search filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor(s)</label>
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="e.g., Paylocity, ADP"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Min Headcount</label>
              <input
                type="number"
                value={minHeadcount}
                onChange={(e) => setMinHeadcount(e.target.value)}
                placeholder="e.g., 50"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Headcount</label>
              <input
                type="number"
                value={maxHeadcount}
                onChange={(e) => setMaxHeadcount(e.target.value)}
                placeholder="e.g., 200"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recency</label>
              <select
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
                <option value="24">Last 2 years</option>
                <option value="120">All time</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
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
                      key={v}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                    >
                      {v}
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
    </div>
  );
}
