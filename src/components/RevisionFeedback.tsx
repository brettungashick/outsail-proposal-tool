'use client';

import { useEffect, useState } from 'react';
import AnalysisLoadingOverlay from '@/components/AnalysisLoadingOverlay';
import RevisionPreview, { PendingRevisionView } from '@/components/RevisionPreview';

const MAX_FEEDBACK_CHARS = 20000;

interface RevisionFeedbackProps {
  analysisId: string;
  version: number;
  /** Called with the new analysis id after a revision is accepted. */
  onAccepted: (newAnalysisId: string) => void;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export default function RevisionFeedback({ analysisId, version, onAccepted }: RevisionFeedbackProps) {
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState<PendingRevisionView | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Restore a draft that was generated but never accepted or discarded.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analysis/${analysisId}/revise`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.pending) return;
        setPending(data.pending);
        setFeedback(data.pending.feedback);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/${analysisId}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) {
        setError(await readError(res, `Revision failed (${res.status})`));
        return;
      }
      const data = await res.json();
      setPending(data.pending);
      setPreviewError(null);
      setShowPreview(true);
    } catch {
      setError('Network error. The revision may still be running; reload the page in a minute to check.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async () => {
    setBusy(true);
    setPreviewError(null);
    try {
      const res = await fetch(`/api/analysis/${analysisId}/revise/accept`, { method: 'POST' });
      if (!res.ok) {
        setPreviewError(await readError(res, `Could not save the revision (${res.status})`));
        return;
      }
      const data = await res.json();
      setPending(null);
      setShowPreview(false);
      setFeedback('');
      onAccepted(data.id);
    } catch {
      setPreviewError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    setBusy(true);
    try {
      await fetch(`/api/analysis/${analysisId}/revise`, { method: 'DELETE' });
      setPending(null);
      setShowPreview(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      {generating && <AnalysisLoadingOverlay statusMessage="Applying your feedback to the analysis..." />}

      <h2 className="font-semibold text-slate-900">Revise with feedback</h2>
      <p className="text-sm text-slate-500 mt-1 mb-3">
        Describe what to change in plain language. The AI keeps everything else as it is, including your
        manual edits, and shows you every change before anything is saved as Version {version + 1}.
      </p>

      {pending && !showPreview && (
        <div className="flex items-center justify-between bg-outsail-blue/10 text-outsail-blue-dark px-4 py-2.5 rounded-lg text-sm mb-3">
          <span>A revision is waiting for your review.</span>
          <button onClick={() => setShowPreview(true)} className="font-medium hover:underline">
            Review changes
          </button>
        </div>
      )}

      <textarea
        rows={5}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder={
          'e.g. "Paylocity\'s Benefits Admin is bundled into Core HR, mark it Included in bundle. ' +
          'Move the carrier feed fees into Implementation. Drop the 401(k) integration row."'
        }
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none resize-y"
      />
      {feedback.length > MAX_FEEDBACK_CHARS && (
        <p className="mt-1.5 text-xs text-amber-700">
          Feedback is limited to {MAX_FEEDBACK_CHARS.toLocaleString()} characters. Try splitting it into rounds.
        </p>
      )}
      {error && <div className="mt-3 bg-red-50 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}

      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={generating || !feedback.trim() || feedback.length > MAX_FEEDBACK_CHARS}
          className="bg-outsail-blue-dark text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
        >
          {generating ? 'Revising...' : pending ? 'Regenerate revision' : 'Revise analysis'}
        </button>
      </div>

      {pending && showPreview && (
        <RevisionPreview
          pending={pending}
          currentVersion={version}
          busy={busy}
          error={previewError}
          onAccept={handleAccept}
          onRefine={() => setShowPreview(false)}
          onDiscard={handleDiscard}
        />
      )}
    </div>
  );
}
