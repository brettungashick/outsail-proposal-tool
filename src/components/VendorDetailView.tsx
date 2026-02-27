'use client';

import { useState, useEffect } from 'react';

interface DocumentData {
  id: string;
  vendorName: string;
  fileName: string;
  documentType: string;
  quoteVersion: number;
  isActive: boolean;
  parsedData: string | null;
  uploadedAt: string;
}

interface ParsedData {
  modules: { name: string; feeAmount: number | null; feeType: string }[];
  implementationItems: { name: string; amount: number | null }[];
  serviceItems: { name: string; amount: number | null; feeType: string }[];
  discounts: { name: string; amount: number | null }[] | string[];
}

interface VendorDetailViewProps {
  projectId: string;
  vendors: string[];
}

export default function VendorDetailView({ projectId, vendors }: VendorDetailViewProps) {
  const [selectedVendor, setSelectedVendor] = useState(vendors[0] || '');
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedVendor) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        const vendorDocs = (data.documents || []).filter(
          (d: DocumentData) => d.vendorName === selectedVendor
        );
        setDocuments(vendorDocs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, selectedVendor]);

  const initialDocs = documents.filter((d) => d.documentType === 'initial_quote');
  const updatedDocs = documents.filter((d) => d.documentType === 'updated_quote');
  const hasRevisions = updatedDocs.length > 0;

  const getLatestParsed = (docs: DocumentData[]): ParsedData | null => {
    const parsed = docs
      .filter((d) => d.parsedData)
      .sort((a, b) => b.quoteVersion - a.quoteVersion);
    if (parsed.length === 0) return null;
    try {
      return JSON.parse(parsed[0].parsedData!);
    } catch {
      return null;
    }
  };

  const initialParsed = getLatestParsed(initialDocs);
  const latestParsed = hasRevisions ? getLatestParsed(updatedDocs) : null;

  const calcTotal = (data: ParsedData | null): number => {
    if (!data) return 0;
    const modulesTotal = data.modules.reduce((sum, m) => sum + (m.feeAmount || 0), 0);
    const implTotal = data.implementationItems.reduce((sum, i) => sum + (i.amount || 0), 0);
    const serviceTotal = data.serviceItems.reduce((sum, s) => sum + (s.amount || 0), 0);
    return modulesTotal + implTotal + serviceTotal;
  };

  const initialTotal = calcTotal(initialParsed);
  const latestTotal = latestParsed ? calcTotal(latestParsed) : initialTotal;
  const savingsDollar = initialTotal - latestTotal;
  const savingsPercent = initialTotal > 0 ? ((savingsDollar / initialTotal) * 100).toFixed(1) : '0';

  return (
    <div>
      {/* Vendor selector */}
      <div className="flex gap-2 mb-6">
        {vendors.map((v) => (
          <button
            key={v}
            onClick={() => setSelectedVendor(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedVendor === v
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading vendor data...</div>
      ) : (
        <div className="space-y-6">
          {/* Quote timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Quote Timeline — {selectedVendor}</h3>
            <div className="space-y-3">
              {documents
                .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime())
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between border rounded-lg px-4 py-3 ${
                      doc.isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          doc.documentType === 'initial_quote'
                            ? 'bg-indigo-500'
                            : doc.documentType === 'updated_quote'
                              ? 'bg-purple-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{doc.fileName}</p>
                        <p className="text-xs text-slate-400">
                          {doc.documentType === 'initial_quote'
                            ? 'Initial Quote'
                            : doc.documentType === 'updated_quote'
                              ? `Revision v${doc.quoteVersion}`
                              : 'Supplemental'}
                          {' · '}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {doc.isActive && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Savings summary (only if revisions exist) */}
          {hasRevisions && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Savings Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Initial Quote</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${initialTotal.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Latest Quote</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${latestTotal.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-4 text-center ${
                    savingsDollar > 0 ? 'bg-green-50' : savingsDollar < 0 ? 'bg-red-50' : 'bg-slate-50'
                  }`}
                >
                  <p className="text-xs text-slate-500 mb-1">Savings</p>
                  <p
                    className={`text-lg font-bold ${
                      savingsDollar > 0
                        ? 'text-green-700'
                        : savingsDollar < 0
                          ? 'text-red-700'
                          : 'text-slate-900'
                    }`}
                  >
                    ${Math.abs(savingsDollar).toLocaleString()} ({savingsPercent}%)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-side comparison of initial vs latest */}
          {hasRevisions && initialParsed && latestParsed && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Initial vs. Latest Quote</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700 border border-slate-200">
                        Line Item
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700 border border-slate-200">
                        Initial
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700 border border-slate-200">
                        Latest
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700 border border-slate-200">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600"
                      >
                        Software Fees
                      </td>
                    </tr>
                    {initialParsed.modules.map((mod, i) => {
                      const latestMod = latestParsed.modules.find((m) => m.name === mod.name);
                      const initialAmt = mod.feeAmount || 0;
                      const latestAmt = latestMod?.feeAmount || 0;
                      const diff = latestAmt - initialAmt;
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 border border-slate-200 text-sm">{mod.name}</td>
                          <td className="px-4 py-2 border border-slate-200 text-sm">
                            {mod.feeAmount != null ? `$${mod.feeAmount.toLocaleString()}` : 'N/A'}
                            {mod.feeType ? ` ${mod.feeType}` : ''}
                          </td>
                          <td className="px-4 py-2 border border-slate-200 text-sm">
                            {latestMod
                              ? latestMod.feeAmount != null
                                ? `$${latestMod.feeAmount.toLocaleString()} ${latestMod.feeType || ''}`
                                : 'N/A'
                              : 'Removed'}
                          </td>
                          <td
                            className={`px-4 py-2 border border-slate-200 text-sm font-medium ${
                              diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-slate-400'
                            }`}
                          >
                            {diff !== 0
                              ? `${diff > 0 ? '+' : ''}$${diff.toLocaleString()}`
                              : 'No change'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600"
                      >
                        Implementation Fees
                      </td>
                    </tr>
                    {initialParsed.implementationItems.map((item, i) => {
                      const latestItem = latestParsed.implementationItems.find(
                        (it) => it.name === item.name
                      );
                      const initialAmt = item.amount || 0;
                      const latestAmt = latestItem?.amount || 0;
                      const diff = latestAmt - initialAmt;
                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 border border-slate-200 text-sm">{item.name}</td>
                          <td className="px-4 py-2 border border-slate-200 text-sm">
                            {item.amount != null ? `$${item.amount.toLocaleString()}` : 'N/A'}
                          </td>
                          <td className="px-4 py-2 border border-slate-200 text-sm">
                            {latestItem
                              ? latestItem.amount != null
                                ? `$${latestItem.amount.toLocaleString()}`
                                : 'N/A'
                              : 'Removed'}
                          </td>
                          <td
                            className={`px-4 py-2 border border-slate-200 text-sm font-medium ${
                              diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-slate-400'
                            }`}
                          >
                            {diff !== 0
                              ? `${diff > 0 ? '+' : ''}$${diff.toLocaleString()}`
                              : 'No change'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Single quote details (no revisions) */}
          {!hasRevisions && initialParsed && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Quote Details</h3>
              <p className="text-sm text-slate-500">
                No revisions uploaded yet for {selectedVendor}. Upload an
                &ldquo;Updated/Revised Quote&rdquo; to see a comparison.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
