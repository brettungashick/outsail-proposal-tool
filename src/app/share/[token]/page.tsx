'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import ComparisonTable from '@/components/ComparisonTable';
import NotesSection from '@/components/NotesSection';
import CitationsSection from '@/components/CitationsSection';
import { ComparisonTable as ComparisonTableType, Citation } from '@/types';

interface ShareData {
  project: {
    name: string;
    clientName: string;
    status: string;
  };
  analysis: {
    version: number;
    comparisonData: string;
    standardizationNotes: string;
    vendorNotes: string;
    nextSteps: string;
    citations: string;
    createdAt: string;
  } | null;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchShareData = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid link');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchShareData();
  }, [fetchShareData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading proposal comparison...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Error</h1>
          <p className="text-slate-500">{error || 'This link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  if (!data.analysis) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SharedHeader projectName={data.project.name} clientName={data.project.clientName} />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
          Analysis is not yet available. Your advisor is still working on it.
        </div>
      </div>
    );
  }

  const comparisonData: ComparisonTableType = JSON.parse(data.analysis.comparisonData);
  const standardizationNotes: string[] = data.analysis.standardizationNotes
    ? JSON.parse(data.analysis.standardizationNotes)
    : [];
  const vendorNotes: Record<string, string[]> = data.analysis.vendorNotes
    ? JSON.parse(data.analysis.vendorNotes)
    : {};
  const nextSteps: string[] = data.analysis.nextSteps
    ? JSON.parse(data.analysis.nextSteps)
    : [];
  const citations: Citation[] = data.analysis.citations
    ? JSON.parse(data.analysis.citations)
    : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <SharedHeader projectName={data.project.name} clientName={data.project.clientName} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-slate-500">
            Version {data.analysis.version} · Generated{' '}
            {new Date(data.analysis.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Comparison Table - Read Only */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">Side-by-Side Comparison</h2>
          <ComparisonTable data={comparisonData} isEditable={false} onCellEdit={() => {}} />
        </div>

        {/* Notes - Read Only */}
        <div className="mb-6">
          <h2 className="font-semibold text-slate-900 text-lg mb-4">Analysis Notes</h2>
          <NotesSection
            standardizationNotes={standardizationNotes}
            vendorNotes={vendorNotes}
            nextSteps={nextSteps}
            isEditable={false}
            onUpdateStandardization={() => {}}
            onUpdateVendorNotes={() => {}}
            onUpdateNextSteps={() => {}}
          />
        </div>

        {/* Citations */}
        <div className="mb-6">
          <CitationsSection citations={citations} />
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-200">
          <p className="text-sm text-slate-400">
            Prepared by OutSail · Proposal Analysis Tool
          </p>
        </div>
      </div>
    </div>
  );
}

function SharedHeader({ projectName, clientName }: { projectName: string; clientName: string }) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-blue-600">OutSail</span>
            <span className="text-sm text-slate-400">|</span>
            <span className="text-sm text-slate-600">Proposal Comparison</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">{clientName}</p>
            <p className="text-xs text-slate-400">{projectName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
