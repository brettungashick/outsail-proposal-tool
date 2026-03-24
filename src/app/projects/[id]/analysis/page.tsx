'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';
import ComparisonTable from '@/components/ComparisonTable';
import NotesSection from '@/components/NotesSection';
import CitationsSection from '@/components/CitationsSection';
import VersionHistory from '@/components/VersionHistory';
import VendorDetailView from '@/components/VendorDetailView';
import { ComparisonTable as ComparisonTableType, Citation, DiscountToggles, HiddenRows, CellStatus } from '@/types';
import { recalculateTable } from '@/lib/recalculate';
import { generateId } from '@/lib/utils';

interface AnalysisData {
  id: string;
  version: number;
  status?: string;
  comparisonData: string;
  standardizationNotes: string;
  vendorNotes: string;
  nextSteps: string;
  citations: string;
  discountToggles: string | null;
  hiddenRows: string | null;
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
  const [hiddenRows, setHiddenRows] = useState<HiddenRows>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // If latest analysis is in clarifying state, redirect to project page
    const latestAnalysis = proj.analyses?.[0];
    if (latestAnalysis?.status === 'clarifying') {
      router.push(`/projects/${projectId}`);
      return;
    }

    const targetId = analysisId || latestAnalysis?.id;

    if (!targetId) {
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/analysis/${targetId}`);
    if (res.ok) {
      const data = await res.json();
      setAnalysis(data);
      if (data.discountToggles) {
        try { setDiscountToggles(JSON.parse(data.discountToggles)); } catch { setDiscountToggles({}); }
      }
      if (data.hiddenRows) {
        try { setHiddenRows(JSON.parse(data.hiddenRows)); } catch { setHiddenRows({}); }
      }
    }
    setLoading(false);
  }, [projectId, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchAnalysis();
  }, [authStatus, fetchAnalysis]);

  const comparisonData: ComparisonTableType | null = analysis
    ? (() => { try { return JSON.parse(analysis.comparisonData); } catch { return null; } })()
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

  // Debounced save for comparison data
  const debouncedSaveComparison = useCallback((newJson: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!analysis) return;
      setSaving(true);
      fetch(`/api/analysis/${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'comparisonData',
          fieldPath: 'comparisonData',
          oldValue: analysis.comparisonData,
          newValue: newJson,
        }),
      }).finally(() => setSaving(false));
    }, 500);
  }, [analysis]);

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
    newDisplayValue: string,
    newAmount: number | null
  ) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    const val = updated.sections[sectionIndex].rows[rowIndex].values[vendorIndex];

    val.display = newDisplayValue;
    if (newAmount !== null) {
      val.amount = newAmount;
    } else {
      // Try to parse from display
      const numVal = parseFloat(newDisplayValue.replace(/[$,]/g, ''));
      if (!isNaN(numVal)) {
        val.amount = numVal;
      }
    }

    // Recalculate subtotals and totals
    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
  };

  const handleCellStatusChange = (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newStatus: CellStatus
  ) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    const val = updated.sections[sectionIndex].rows[rowIndex].values[vendorIndex];

    const displayMap: Record<CellStatus, string> = {
      currency: val.display,
      tbc: 'To be confirmed',
      included: 'Included',
      included_in_bundle: 'Included in bundle',
      not_included: 'Not included',
      na: 'N/A',
      hidden: 'Hidden',
    };

    val.display = displayMap[newStatus];
    val.status = newStatus;
    val.isConfirmed = newStatus !== 'tbc';
    if (newStatus !== 'currency') {
      val.amount = null;
    }

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
  };

  const handleDiscountToggle = (vendorName: string, discountId: string, enabled: boolean) => {
    const updated = { ...discountToggles };
    if (!updated[vendorName]) updated[vendorName] = {};
    updated[vendorName][discountId] = enabled;
    setDiscountToggles(updated);

    // Recalculate with new toggles
    if (comparisonData && analysis) {
      const recalculated = recalculateTable(comparisonData, updated, hiddenRows);
      const newJson = JSON.stringify(recalculated);
      setAnalysis({ ...analysis, comparisonData: newJson, discountToggles: JSON.stringify(updated) });
      debouncedSaveComparison(newJson);

      // Also save discount toggles
      setSaving(true);
      fetch(`/api/analysis/${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'discountToggles',
          fieldPath: 'discountToggles',
          oldValue: analysis.discountToggles || '{}',
          newValue: JSON.stringify(updated),
        }),
      }).finally(() => setSaving(false));
    }
  };

  const handleToggleHidden = (rowId: string) => {
    const updated = { ...hiddenRows };
    if (updated[rowId]) {
      delete updated[rowId];
    } else {
      updated[rowId] = true;
    }
    setHiddenRows(updated);

    if (comparisonData && analysis) {
      const recalculated = recalculateTable(comparisonData, discountToggles, updated);
      const newJson = JSON.stringify(recalculated);
      setAnalysis({ ...analysis, comparisonData: newJson, hiddenRows: JSON.stringify(updated) });
      debouncedSaveComparison(newJson);

      // Save hidden rows
      fetch(`/api/analysis/${analysis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'hiddenRows',
          fieldPath: 'hiddenRows',
          oldValue: analysis.hiddenRows || '{}',
          newValue: JSON.stringify(updated),
        }),
      });
    }
  };

  const handleAddRow = (sectionIndex: number) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    const section = updated.sections[sectionIndex];
    const isDiscountSection = section.name === 'Discounts';

    const newRow = {
      id: generateId(),
      label: 'New Item',
      values: updated.vendors.map(() => ({
        amount: null,
        display: 'To be confirmed',
        note: null,
        citation: null,
        isConfirmed: false,
      })),
      isDiscount: isDiscountSection,
      isSubtotal: false,
    };

    // Insert before subtotal row if one exists
    const subtotalIdx = section.rows.findIndex(r => r.isSubtotal);
    if (subtotalIdx >= 0) {
      section.rows.splice(subtotalIdx, 0, newRow);
    } else {
      section.rows.push(newRow);
    }

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
  };

  const handleDeleteRow = (sectionIndex: number, rowIndex: number) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    updated.sections[sectionIndex].rows.splice(rowIndex, 1);

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
  };

  const handleRowLabelEdit = (sectionIndex: number, rowIndex: number, newLabel: string) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    updated.sections[sectionIndex].rows[rowIndex].label = newLabel;

    const newJson = JSON.stringify(updated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
  };

  const handleRowReorder = (sectionIndex: number, fromIndex: number, toIndex: number) => {
    if (!comparisonData || !analysis) return;

    const updated = structuredClone(comparisonData);
    const rows = updated.sections[sectionIndex].rows;
    const [moved] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, moved);

    const newJson = JSON.stringify(updated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(newJson);
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
                hiddenRows={hiddenRows}
                onToggleHidden={canEdit ? handleToggleHidden : undefined}
                onAddRow={canEdit ? handleAddRow : undefined}
                onDeleteRow={canEdit ? handleDeleteRow : undefined}
                onRowLabelEdit={canEdit ? handleRowLabelEdit : undefined}
                onCellStatusChange={canEdit ? handleCellStatusChange : undefined}
                onRowReorder={canEdit ? handleRowReorder : undefined}
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
