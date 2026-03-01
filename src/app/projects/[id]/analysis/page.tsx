'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ComparisonTable from '@/components/ComparisonTable';
import NotesSection from '@/components/NotesSection';
import CitationsSection from '@/components/CitationsSection';
import VersionHistory from '@/components/VersionHistory';
import VendorDetailView from '@/components/VendorDetailView';
import AuditDrawer from '@/components/AuditDrawer';
import { ComparisonTable as ComparisonTableType, Citation, DiscountToggles, HiddenRows, CellStatus } from '@/types';
import { recalculateTable } from '@/lib/recalculate';
import { generateId, formatCurrency } from '@/lib/utils';

interface AnalysisData {
  id: string;
  version: number;
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
  const { data: session, status: authStatus } = useSession();
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
  const [auditDrawer, setAuditDrawer] = useState<{ si: number; ri: number; vi: number } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const latestAnalysis = proj.analyses?.[0];
    // If the latest analysis is still in clarifying state, redirect to project page
    if (latestAnalysis?.status === 'clarifying' && !analysisId) {
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
      // Double-check status from full analysis data
      if (data.status === 'clarifying') {
        router.push(`/projects/${projectId}`);
        return;
      }
      setAnalysis(data);
      // Load discount toggles
      if (data.discountToggles) {
        try {
          setDiscountToggles(JSON.parse(data.discountToggles));
        } catch {
          setDiscountToggles({});
        }
      }
      // Load hidden rows
      if (data.hiddenRows) {
        try {
          setHiddenRows(JSON.parse(data.hiddenRows));
        } catch {
          setHiddenRows({});
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

  // Debounced save for comparison data — avoids hammering the server on rapid edits
  const debouncedSaveComparison = useCallback((analysisId: string, newJson: string, oldJson: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      fetch(`/api/analysis/${analysisId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType: 'comparisonData',
          fieldPath: 'comparisonData',
          oldValue: oldJson,
          newValue: newJson,
        }),
      }).finally(() => setSaving(false));
    }, 500);
  }, []);

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

  const deriveStatusFromDisplay = (display: string): CellStatus => {
    const d = display.toLowerCase().trim();
    if (d === 'included') return 'included';
    if (d === 'included in bundle') return 'included_in_bundle';
    if (d === 'not included') return 'not_included';
    if (d === 'n/a') return 'na';
    if (d === 'hidden') return 'hidden';
    if (d === 'to be confirmed') return 'tbc';
    return 'currency';
  };

  const STATUS_DISPLAY_MAP: Record<CellStatus, string> = {
    currency: '',
    tbc: 'To be confirmed',
    included: 'Included',
    included_in_bundle: 'Included in bundle',
    not_included: 'Not included',
    na: 'N/A',
    hidden: 'Hidden',
  };

  const userId = (session?.user as { id: string } | undefined)?.id;

  // Fire-and-forget learning event emission — never blocks the UI
  const emitLearningEvent = useCallback((event: {
    analysisId: string;
    projectId: string;
    vendorName: string;
    rowId: string;
    sectionName: string;
    vendorIndex: number;
    editType: 'value_change' | 'status_change' | 'label_change';
    oldDisplay: string;
    oldAmount: number | null;
    oldStatus?: string;
    newDisplay: string;
    newAmount: number | null;
    newStatus?: string;
    rowLabel: string;
  }) => {
    fetch('/api/learning-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {}); // Silently ignore failures
  }, []);

  const applyOverride = (
    val: ComparisonTableType['sections'][0]['rows'][0]['values'][0],
    updated: ComparisonTableType,
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newDisplay: string,
    newAmount: number | null
  ) => {
    const priorDisplay = val.display;
    const priorAmount = val.amount;

    if (!val.audit) val.audit = { sources: [], override: null, formula: null };
    val.audit.override = {
      overriddenBy: userId || 'unknown',
      overriddenAt: new Date().toISOString(),
      priorDisplay,
      priorAmount,
    };

    if (!updated.auditLog) updated.auditLog = [];
    updated.auditLog.push({
      type: 'user_override_cell',
      timestamp: new Date().toISOString(),
      cellPath: `sections[${sectionIndex}].rows[${rowIndex}].values[${vendorIndex}]`,
      userId: userId || null,
      display: newDisplay,
      amount: newAmount,
    });
  };

  const handleCellEdit = (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newDisplayValue: string,
    newAmount: number | null
  ) => {
    if (!comparisonData || !analysis) return;

    const updated: ComparisonTableType = structuredClone(comparisonData);
    const row = updated.sections[sectionIndex].rows[rowIndex];
    const val = row.values[vendorIndex];

    // Capture prior state for learning event
    const oldDisplay = val.display;
    const oldAmount = val.amount;
    const oldStatus = val.status;

    applyOverride(val, updated, sectionIndex, rowIndex, vendorIndex, newDisplayValue, newAmount);

    val.display = newDisplayValue;
    val.amount = newAmount;
    val.status = newAmount !== null ? 'currency' : deriveStatusFromDisplay(newDisplayValue);
    val.isConfirmed = val.status !== 'tbc';

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });

    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);

    // Emit learning event
    emitLearningEvent({
      analysisId: analysis.id,
      projectId,
      vendorName: comparisonData.vendors[vendorIndex] || '',
      rowId: row.id,
      sectionName: comparisonData.sections[sectionIndex].name,
      vendorIndex,
      editType: 'value_change',
      oldDisplay,
      oldAmount,
      oldStatus,
      newDisplay: newDisplayValue,
      newAmount,
      newStatus: val.status,
      rowLabel: row.label,
    });
  };

  const handleCellStatusChange = (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newStatus: CellStatus
  ) => {
    if (!comparisonData || !analysis) return;

    const updated: ComparisonTableType = structuredClone(comparisonData);
    const row = updated.sections[sectionIndex].rows[rowIndex];
    const val = row.values[vendorIndex];
    const newDisplay = STATUS_DISPLAY_MAP[newStatus];

    // Capture prior state for learning event
    const oldDisplay = val.display;
    const oldAmount = val.amount;
    const oldStatus = val.status;

    applyOverride(val, updated, sectionIndex, rowIndex, vendorIndex, newDisplay, null);

    val.status = newStatus;
    val.display = newDisplay;
    val.amount = null;
    val.isConfirmed = newStatus !== 'tbc';

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });

    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);

    // Emit learning event
    emitLearningEvent({
      analysisId: analysis.id,
      projectId,
      vendorName: comparisonData.vendors[vendorIndex] || '',
      rowId: row.id,
      sectionName: comparisonData.sections[sectionIndex].name,
      vendorIndex,
      editType: 'status_change',
      oldDisplay,
      oldAmount,
      oldStatus,
      newDisplay,
      newAmount: null,
      newStatus: newStatus,
      rowLabel: row.label,
    });
  };

  const handleDiscountToggle = (vendorName: string, discountId: string, enabled: boolean) => {
    const updatedToggles = { ...discountToggles };
    if (!updatedToggles[vendorName]) updatedToggles[vendorName] = {};
    updatedToggles[vendorName][discountId] = enabled;
    setDiscountToggles(updatedToggles);

    if (!comparisonData || !analysis) return;

    // Recalculate with new toggles
    const recalculated = recalculateTable(comparisonData, updatedToggles, hiddenRows);
    const newCompJson = JSON.stringify(recalculated);
    const newToggleJson = JSON.stringify(updatedToggles);

    setAnalysis({
      ...analysis,
      comparisonData: newCompJson,
      discountToggles: newToggleJson,
    });

    // Save both comparison data and toggle state
    debouncedSaveComparison(analysis.id, newCompJson, analysis.comparisonData);
    setSaving(true);
    fetch(`/api/analysis/${analysis.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldType: 'discountToggles',
        fieldPath: 'discountToggles',
        oldValue: analysis.discountToggles || '{}',
        newValue: newToggleJson,
      }),
    }).finally(() => setSaving(false));
  };

  const handleAddRow = (sectionIndex: number) => {
    if (!comparisonData || !analysis) return;

    const updated: ComparisonTableType = structuredClone(comparisonData);
    const section = updated.sections[sectionIndex];
    const isDiscountSection = section.name === 'Discounts';

    // Insert before any subtotal row, or at end
    const subtotalIdx = section.rows.findIndex((r) => r.isSubtotal);
    const insertAt = subtotalIdx >= 0 ? subtotalIdx : section.rows.length;

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

    section.rows.splice(insertAt, 0, newRow);

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);
  };

  const handleDeleteRow = (sectionIndex: number, rowIndex: number) => {
    if (!comparisonData || !analysis) return;

    const updated: ComparisonTableType = structuredClone(comparisonData);
    const row = updated.sections[sectionIndex].rows[rowIndex];

    // Don't delete subtotal rows
    if (row.isSubtotal) return;

    updated.sections[sectionIndex].rows.splice(rowIndex, 1);

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);
  };

  const handleRowLabelEdit = (sectionIndex: number, rowIndex: number, newLabel: string) => {
    if (!comparisonData || !analysis) return;
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    const row = comparisonData.sections[sectionIndex].rows[rowIndex];
    const oldLabel = row.label;

    const updated: ComparisonTableType = structuredClone(comparisonData);
    updated.sections[sectionIndex].rows[rowIndex].label = trimmed;
    const newJson = JSON.stringify(updated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);

    // Emit learning event (use vendorIndex 0 — label edits apply to the row, not a specific vendor)
    if (oldLabel !== trimmed) {
      emitLearningEvent({
        analysisId: analysis.id,
        projectId,
        vendorName: '',
        rowId: row.id,
        sectionName: comparisonData.sections[sectionIndex].name,
        vendorIndex: 0,
        editType: 'label_change',
        oldDisplay: oldLabel,
        oldAmount: null,
        newDisplay: trimmed,
        newAmount: null,
        rowLabel: trimmed,
      });
    }
  };

  const handleToggleHidden = (rowId: string) => {
    if (!comparisonData || !analysis) return;

    const updatedHidden = { ...hiddenRows };
    updatedHidden[rowId] = !updatedHidden[rowId];
    if (!updatedHidden[rowId]) delete updatedHidden[rowId];
    setHiddenRows(updatedHidden);

    // Recalculate with updated hidden state
    const recalculated = recalculateTable(comparisonData, discountToggles, updatedHidden);
    const newCompJson = JSON.stringify(recalculated);
    const newHiddenJson = JSON.stringify(updatedHidden);

    setAnalysis({
      ...analysis,
      comparisonData: newCompJson,
      hiddenRows: newHiddenJson,
    });

    debouncedSaveComparison(analysis.id, newCompJson, analysis.comparisonData);
    // Save hidden rows state
    setSaving(true);
    fetch(`/api/analysis/${analysis.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldType: 'hiddenRows',
        fieldPath: 'hiddenRows',
        oldValue: analysis.hiddenRows || '{}',
        newValue: newHiddenJson,
      }),
    }).finally(() => setSaving(false));
  };

  const handleHeadcountChange = (newHeadcount: number) => {
    if (!comparisonData || !analysis) return;

    const oldHeadcount = comparisonData.normalizedHeadcount;
    if (!oldHeadcount || oldHeadcount === newHeadcount) return;

    const ratio = newHeadcount / oldHeadcount;
    const updated: ComparisonTableType = structuredClone(comparisonData);
    updated.normalizedHeadcount = newHeadcount;

    // Scale recurring fee sections (Software, Service) — these are PEPM-based annualized values
    const recurringNames = ['Software Fees (Recurring)', 'Service Fees (Recurring)'];
    for (const section of updated.sections) {
      if (!recurringNames.includes(section.name)) continue;
      for (const row of section.rows) {
        if (row.isSubtotal) continue;
        for (const val of row.values) {
          if (val.amount !== null && val.amount !== 0) {
            val.amount = Math.round(val.amount * ratio);
            val.display = formatCurrency(val.amount);
          }
        }
      }
    }

    const recalculated = recalculateTable(updated, discountToggles, hiddenRows);
    const newJson = JSON.stringify(recalculated);
    setAnalysis({ ...analysis, comparisonData: newJson });
    debouncedSaveComparison(analysis.id, newJson, analysis.comparisonData);
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
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </Sidebar>
    );
  }

  if (!analysis || !comparisonData) {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-500 mb-4">No analysis available</p>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            &larr; Back to Project
          </button>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-sm text-indigo-600 hover:text-indigo-800 mb-2 inline-block"
          >
            &larr; Back to Project
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Proposal Comparison &mdash; {analysis.project.clientName}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {analysis.project.name} &middot; Version {analysis.version} &middot; Generated{' '}
                {new Date(analysis.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saving && (
                <span className="text-xs text-indigo-500">Saving...</span>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
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
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('vendor-detail')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'vendor-detail'
                  ? 'border-indigo-600 text-indigo-600'
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
                  {canEdit ? 'Click any cell to edit · Totals auto-calculate · ' : ''}Yellow = To be confirmed
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
                onHeadcountChange={canEdit ? handleHeadcountChange : undefined}
                onRowLabelEdit={canEdit ? handleRowLabelEdit : undefined}
                onCellStatusChange={canEdit ? handleCellStatusChange : undefined}
                onAuditClick={(si, ri, vi) => setAuditDrawer({ si, ri, vi })}
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

      {/* Audit Drawer */}
      {auditDrawer && comparisonData && (
        <AuditDrawer
          isOpen={true}
          onClose={() => setAuditDrawer(null)}
          cellPath={`sections[${auditDrawer.si}].rows[${auditDrawer.ri}].values[${auditDrawer.vi}]`}
          vendorValue={comparisonData.sections[auditDrawer.si].rows[auditDrawer.ri].values[auditDrawer.vi]}
          auditLog={comparisonData.auditLog || []}
          onRevert={canEdit ? (priorDisplay, priorAmount) => {
            handleCellEdit(auditDrawer.si, auditDrawer.ri, auditDrawer.vi, priorDisplay, priorAmount);
            setAuditDrawer(null);
          } : undefined}
        />
      )}
    </Sidebar>
  );
}
