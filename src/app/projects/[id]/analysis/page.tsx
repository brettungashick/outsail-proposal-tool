'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import ComparisonTable from '@/components/ComparisonTable';
import NotesSection from '@/components/NotesSection';
import CitationsSection from '@/components/CitationsSection';
import VersionHistory from '@/components/VersionHistory';
import VendorDetailView from '@/components/VendorDetailView';
import { ComparisonTable as ComparisonTableType, Citation, DiscountToggles } from '@/types';

interface AnalysisData {
  id: string;
  version: number;
  comparisonData: string;
  standardizationNotes: string;
  vendorNotes: string;
  nextSteps: string;
  citations: string;
  discountToggles: string | null;
  createdAt: string;
  project: { name: string; clientName: string; isOwner?: boolean; isAdmin?: boolean };
}

type AnalysisTab = 'summary' | 'vendor-detail';

export default function AnalysisPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('summary');
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [discountToggles, setDiscountToggles] = useState<DiscountToggles>({});
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  const fetchAnalysis = useCallback(async (analysisId?: string) => {
    const projRes = await fetch(`/api/projects/${projectId}`);
    if (!projRes.ok) {
      setLoading(false);
      return;
    }
    const proj = await projRes.json();
    setIsOwner(proj.isOwner);
    setIsAdmin(proj.isAdmin);
    const targetId = analysisId || proj.analyses?.[0]?.id;

    if (!targetId) {
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/analysis/${targetId}`);
    if (res.ok) {
      const data = await res.json();
      setAnalysis(data);
      // Load discount toggles
      if (data.discountToggles) {
        try {
          setDiscountToggles(JSON.parse(data.discountToggles));
        } catch {
          setDiscountToggles({});
        }
      }
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchAnalysis();
  }, [authStatus, fetchAnalysis]);

  const comparisonData: ComparisonTableType | null = analysis
    ? JSON.parse(analysis.comparisonData)
    : null;
  const standardizationNotes: string[] = analysis?.standardizationNotes
    ? JSON.parse(analysis.standardizationNotes)
    : [];
  const vendorNotes: Record<string, string[]> = analysis?.vendorNotes
    ? JSON.parse(analysis.vendorNotes)
    : {};
  const nextSteps: string[] = analysis?.nextSteps ? JSON.parse(analysis.nextSteps) : [];
  const citations: Citation[] = analysis?.citations ? JSON.parse(analysis.citations) : [];

  const canEdit = isOwner || isAdmin;

  const saveField = async (fieldType: string, fieldPath: string, oldValue: string, newValue: string) => {
    if (!analysis) return;
    setSaving(true);
    try {
      await fetch(`/api/analysis/${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldType, fieldPath, oldValue, newValue }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCellEdit = (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newDisplayValue: string
  ) => {
    if (!comparisonData || !analysis) return;

    const updated = { ...comparisonData };
    const section = { ...updated.sections[sectionIndex] };
    const row = { ...section.rows[rowIndex] };
    const val = { ...row.values[vendorIndex] };

    const oldDisplay = val.display;
    val.display = newDisplayValue;

    const numVal = parseFloat(newDisplayValue.replace(/[$,]/g, ''));
    if (!isNaN(numVal)) {
      val.amount = numVal;
    }

    row.values = [...row.values];
    row.values[vendorIndex] = val;
    section.rows = [...section.rows];
    section.rows[rowIndex] = row;
    updated.sections = [...updated.sections];
    updated.sections[sectionIndex] = section;

    const newJson = JSON.stringify(updated);
    setAnalysis({ ...analysis, comparisonData: newJson });

    saveField(
      'comparisonData',
      `sections[${sectionIndex}].rows[${rowIndex}].values[${vendorIndex}].display`,
      oldDisplay,
      newJson
    );
  };

  const handleDiscountToggle = (vendorName: string, discountId: string, enabled: boolean) => {
    const updated = { ...discountToggles };
    if (!updated[vendorName]) updated[vendorName] = {};
    updated[vendorName][discountId] = enabled;
    setDiscountToggles(updated);

    // Persist to server
    if (analysis) {
      const newVal = JSON.stringify(updated);
      setSaving(true);
      fetch(`/api/analysis/${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'discountToggles',
          fieldPath: 'discountToggles',
          oldValue: analysis.discountToggles || '{}',
          newValue: newVal,
        }),
      }).finally(() => setSaving(false));
      setAnalysis({ ...analysis, discountToggles: newVal });
    }
  };

  const handleUpdateStandardization = (notes: string[]) => {
    if (!analysis) return;
    const oldVal = analysis.standardizationNotes;
    const newVal = JSON.stringify(notes);
    setAnalysis({ ...analysis, standardizationNotes: newVal });
    saveField('standardizationNotes', 'standardizationNotes', oldVal, newVal);
  };

  const handleUpdateVendorNotes = (notes: Record<string, string[]>) => {
    if (!analysis) return;
    const oldVal = analysis.vendorNotes;
    const newVal = JSON.stringify(notes);
    setAnalysis({ ...analysis, vendorNotes: newVal });
    saveField('vendorNotes', 'vendorNotes', oldVal, newVal);
  };

  const handleUpdateNextSteps = (steps: string[]) => {
    if (!analysis) return;
    const oldVal = analysis.nextSteps;
    const newVal = JSON.stringify(steps);
    setAnalysis({ ...analysis, nextSteps: newVal });
    saveField('nextSteps', 'nextSteps', oldVal, newVal);
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!analysis || !comparisonData) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-500 mb-4">No analysis available</p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Back to Project
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Proposal Comparison — {analysis.project.clientName}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {analysis.project.name} · Version {analysis.version} · Generated{' '}
                {new Date(analysis.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saving && (
                <span className="text-xs text-blue-500">Saving...</span>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        window.open(`/api/analysis/${analysis.id}/export?format=pdf`, '_blank');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        window.open(`/api/analysis/${analysis.id}/export?format=excel`, '_blank');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg"
                    >
                      Download Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowHistory(true)}
                className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                Version History
              </button>
            </div>
          </div>
        </div>

        {/* Analysis Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('summary')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'summary'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('vendor-detail')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'vendor-detail'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Vendor Detail
            </button>
          </div>
        </div>

        {activeTab === 'summary' && (
          <>
            {/* Comparison Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-900">Side-by-Side Comparison</h2>
                <p className="text-xs text-slate-400">
                  {canEdit ? 'Click any cell to edit · ' : ''}Yellow = To be confirmed
                </p>
              </div>
              <ComparisonTable
                data={comparisonData}
                isEditable={canEdit}
                onCellEdit={handleCellEdit}
                discountToggles={discountToggles}
                onDiscountToggle={canEdit ? handleDiscountToggle : undefined}
              />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <h2 className="font-semibold text-slate-900 text-lg mb-4">Analysis Notes</h2>
              <NotesSection
                standardizationNotes={standardizationNotes}
                vendorNotes={vendorNotes}
                nextSteps={nextSteps}
                isEditable={canEdit}
                onUpdateStandardization={handleUpdateStandardization}
                onUpdateVendorNotes={handleUpdateVendorNotes}
                onUpdateNextSteps={handleUpdateNextSteps}
              />
            </div>

            {/* Citations */}
            <div className="mb-6">
              <CitationsSection citations={citations} />
            </div>
          </>
        )}

        {activeTab === 'vendor-detail' && (
          <VendorDetailView
            projectId={projectId}
            vendors={comparisonData.vendors}
          />
        )}
      </div>

      {/* Version History Sidebar */}
      <VersionHistory
        analysisId={analysis.id}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectVersion={(versionId) => {
          setShowHistory(false);
          fetchAnalysis(versionId);
        }}
      />
    </div>
  );
}
