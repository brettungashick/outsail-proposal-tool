'use client';

import type { AnalysisDiff, ListDiff, RowChange } from '@/lib/revision';

export interface PendingRevisionView {
  feedback: string;
  changeSummary: string[];
  createdAt: string;
  /** The table was edited after this draft was generated; it can't be accepted. */
  stale: boolean;
  diff: AnalysisDiff;
}

interface RevisionPreviewProps {
  pending: PendingRevisionView;
  currentVersion: number;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onRefine: () => void;
  onDiscard: () => void;
}

function ChangedRow({ row }: { row: RowChange }) {
  return (
    <div className={`px-4 py-2.5 text-sm ${row.computed ? 'opacity-60' : ''}`}>
      <div className="font-medium text-slate-800">
        {row.previousLabel ? (
          <>
            <span className="text-red-600 line-through font-normal">{row.previousLabel}</span> → {row.label}
          </>
        ) : (
          row.label
        )}
        {row.computed && <span className="ml-2 text-xs font-normal text-slate-400">recalculated</span>}
      </div>
      {row.cells.map((cell) => (
        <div key={cell.vendor} className="text-xs text-slate-600 mt-1">
          <span className="text-slate-500">{cell.vendor}:</span>{' '}
          <span className="text-red-600 line-through">{cell.before}</span>{' '}
          → <span className="text-green-700">{cell.after}</span>
        </div>
      ))}
    </div>
  );
}

function NoteChanges({ title, diff }: { title: string; diff: ListDiff }) {
  if (!diff.added.length && !diff.removed.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{title}</h4>
      <ul className="space-y-1 text-sm">
        {diff.removed.map((note, i) => (
          <li key={`r${i}`} className="text-red-600 line-through">{note}</li>
        ))}
        {diff.added.map((note, i) => (
          <li key={`a${i}`} className="text-green-700">{note}</li>
        ))}
      </ul>
    </div>
  );
}

export default function RevisionPreview({
  pending,
  currentVersion,
  busy,
  error,
  onAccept,
  onRefine,
  onDiscard,
}: RevisionPreviewProps) {
  const { diff } = pending;
  const hasNoteChanges =
    diff.standardizationNotes.added.length + diff.standardizationNotes.removed.length > 0 ||
    diff.nextSteps.added.length + diff.nextSteps.removed.length > 0 ||
    Object.keys(diff.vendorNotes).length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Review proposed changes</h2>
          <p className="text-xs text-slate-500 mt-1">
            {diff.changeCount} change{diff.changeCount === 1 ? '' : 's'}, plus recalculated totals. Nothing is saved
            until you accept.
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-1.5">Your feedback</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {pending.feedback}
            </p>
          </div>

          {pending.changeSummary.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-1.5">What the AI says it changed</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                {pending.changeSummary.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-1">Every change to the table</h3>
            <p className="text-xs text-slate-500 mb-3">
              Compared cell by cell against Version {currentVersion}. Check for anything you didn&apos;t ask for.
              Subtotals and totals are recalculated automatically.
            </p>

            {diff.changeCount === 0 && (
              <p className="text-sm text-slate-500">The revision made no changes.</p>
            )}

            <div className="space-y-4">
              {diff.headcount && (
                <p className="text-sm text-slate-700">
                  Normalized headcount:{' '}
                  <span className="text-red-600 line-through">{diff.headcount.before}</span>{' '}
                  → <span className="text-green-700">{diff.headcount.after}</span>
                </p>
              )}
              {diff.addedSections.map((name) => (
                <p key={name} className="text-sm text-green-700">New section: {name}</p>
              ))}
              {diff.removedSections.map((name) => (
                <p key={name} className="text-sm text-red-600">Removed section: {name}</p>
              ))}

              {diff.sections.map((section) => (
                <div key={section.name} className="border border-slate-200 rounded-lg">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-800 rounded-t-lg">
                    {section.name}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {section.changed.filter((r) => !r.computed).map((row) => (
                      <ChangedRow key={row.rowId} row={row} />
                    ))}
                    {section.added.map((row) => (
                      <div key={row.rowId} className="px-4 py-2.5 text-sm">
                        <div className="font-medium text-green-700">+ {row.label}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {row.cells.map((c) => `${c.vendor}: ${c.display}`).join(' · ')}
                        </div>
                      </div>
                    ))}
                    {section.removed.map((row) => (
                      <div key={row.rowId} className="px-4 py-2.5 text-sm text-red-600">
                        − {row.label}
                      </div>
                    ))}
                    {section.changed.filter((r) => r.computed).map((row) => (
                      <ChangedRow key={row.rowId} row={row} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {hasNoteChanges && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Notes</h3>
              <NoteChanges title="Standardization notes" diff={diff.standardizationNotes} />
              {Object.entries(diff.vendorNotes).map(([vendor, d]) => (
                <NoteChanges key={vendor} title={`${vendor} notes`} diff={d} />
              ))}
              <NoteChanges title="Next steps" diff={diff.nextSteps} />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 space-y-3">
          {pending.stale && (
            <div className="bg-amber-50 text-amber-800 px-4 py-2.5 rounded-lg text-sm">
              The table was edited after this revision was generated. Refine and resubmit so your edits are kept.
            </div>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onDiscard}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={onRefine}
              disabled={busy}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
            >
              Refine feedback
            </button>
            <button
              onClick={onAccept}
              disabled={busy || pending.stale}
              className="bg-outsail-blue-dark text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
            >
              {busy ? 'Saving...' : `Accept as Version ${currentVersion + 1}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
