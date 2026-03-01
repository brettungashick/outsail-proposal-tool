'use client';

import { useState, useCallback } from 'react';
import { VendorValue, CellAuditEvent, SourcePointer } from '@/types';

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cellPath: string;
  vendorValue: VendorValue;
  auditLog: CellAuditEvent[];
  onRevert?: (priorDisplay: string, priorAmount: number | null) => void;
}

export default function AuditDrawer({
  isOpen,
  onClose,
  cellPath,
  vendorValue,
  auditLog,
  onRevert,
}: AuditDrawerProps) {
  const [snippetCache, setSnippetCache] = useState<Record<string, { snippet: string; highlightStart: number; highlightEnd: number; fileName: string }>>({});
  const [loadingSnippet, setLoadingSnippet] = useState<string | null>(null);

  const audit = vendorValue.audit;
  const cellEvents = auditLog.filter((e) => e.cellPath === cellPath);

  const fetchSnippet = useCallback(async (source: SourcePointer) => {
    const cacheKey = `${source.documentId}:${source.charOffsetStart}:${source.charOffsetEnd}`;
    if (snippetCache[cacheKey]) return;

    setLoadingSnippet(cacheKey);
    try {
      const res = await fetch(
        `/api/documents/${source.documentId}/snippet?start=${source.charOffsetStart}&end=${source.charOffsetEnd}&context=150`
      );
      if (res.ok) {
        const data = await res.json();
        setSnippetCache((prev) => ({ ...prev, [cacheKey]: data }));
      }
    } finally {
      setLoadingSnippet(null);
    }
  }, [snippetCache]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl z-50 overflow-y-auto border-l border-slate-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Cell Audit Details</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Current Value */}
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Value</h4>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm font-medium text-slate-900">{vendorValue.display}</p>
              {vendorValue.amount !== null && (
                <p className="text-xs text-slate-500 mt-1">Amount: ${vendorValue.amount.toLocaleString()}</p>
              )}
              <p className={`text-xs mt-1 ${vendorValue.isConfirmed ? 'text-green-600' : 'text-amber-600'}`}>
                {vendorValue.isConfirmed ? 'Confirmed' : 'Unconfirmed'}
              </p>
              {vendorValue.status && (
                <p className="text-xs text-slate-400 mt-1">Status: {vendorValue.status}</p>
              )}
            </div>
          </section>

          {/* Sources */}
          {audit && audit.sources.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sources</h4>
              <div className="space-y-2">
                {audit.sources.map((source, idx) => {
                  const cacheKey = `${source.documentId}:${source.charOffsetStart}:${source.charOffsetEnd}`;
                  const cached = snippetCache[cacheKey];
                  const canFetchEvidence = source.charOffsetStart !== -1 && source.charOffsetEnd !== -1;

                  return (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-sm font-medium text-slate-700">{source.label}</span>
                      </div>
                      {canFetchEvidence && !cached && (
                        <button
                          onClick={() => fetchSnippet(source)}
                          disabled={loadingSnippet === cacheKey}
                          className="text-xs text-indigo-600 hover:text-indigo-800 mt-1"
                        >
                          {loadingSnippet === cacheKey ? 'Loading...' : 'View evidence'}
                        </button>
                      )}
                      {!canFetchEvidence && (
                        <p className="text-xs text-slate-400 mt-1 italic">Evidence not located exactly</p>
                      )}
                      {cached && (
                        <div className="mt-2 p-2 bg-white border border-slate-200 rounded text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {cached.snippet.substring(0, cached.highlightStart)}
                          <mark className="bg-yellow-200 text-slate-900">
                            {cached.snippet.substring(cached.highlightStart, cached.highlightEnd)}
                          </mark>
                          {cached.snippet.substring(cached.highlightEnd)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Formula */}
          {audit?.formula && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Formula</h4>
              <div className="bg-slate-50 rounded-lg p-3">
                <code className="text-xs text-slate-700 font-mono">{audit.formula}</code>
              </div>
            </section>
          )}

          {/* Override */}
          {audit?.override && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Override</h4>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                <p className="text-sm text-amber-800">
                  Value was manually changed on{' '}
                  {new Date(audit.override.overriddenAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Previous value: <span className="font-medium">{audit.override.priorDisplay}</span>
                  {audit.override.priorAmount !== null && ` ($${audit.override.priorAmount.toLocaleString()})`}
                </p>
                {onRevert && (
                  <button
                    onClick={() => onRevert(audit.override!.priorDisplay, audit.override!.priorAmount)}
                    className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
                  >
                    Revert to previous value
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Event Log */}
          {cellEvents.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                History ({cellEvents.length})
              </h4>
              <div className="space-y-1.5">
                {cellEvents.map((event, idx) => (
                  <div key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      event.type === 'extraction_set_cell' ? 'bg-indigo-400' : 'bg-amber-400'
                    }`} />
                    <div>
                      <span className="font-medium">
                        {event.type === 'extraction_set_cell' ? 'AI extracted' : 'User override'}
                      </span>
                      {': '}
                      <span className="text-slate-500">{event.display}</span>
                      <div className="text-slate-400">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
