'use client';

import { useState, useRef, useEffect } from 'react';
import { ClarifyingQuestion } from '@/types';
import AnalysisLoadingOverlay from '@/components/AnalysisLoadingOverlay';

interface UploadedDoc {
  id: string;
  vendorName: string;
  fileName: string;
  documentType: string;
  isActive: boolean;
}

interface VendorOption {
  id: string;
  name: string;
  accentColor: string | null;
}

interface ClarifyingReviewProps {
  analysisId: string;
  projectId: string;
  questionsJson: string;
  documents: UploadedDoc[];
  onFinalized: () => void;
  onDocumentsChanged: () => void;
  readOnly?: boolean;
}

const categoryLabels: Record<string, string> = {
  missing_data: 'Missing Data',
  ambiguity: 'Ambiguity',
  discrepancy: 'Discrepancy',
  assumption: 'Assumption',
  general: 'General',
};

const categoryColors: Record<string, string> = {
  missing_data: 'bg-red-100 text-red-700',
  ambiguity: 'bg-amber-100 text-amber-700',
  discrepancy: 'bg-purple-100 text-purple-700',
  assumption: 'bg-blue-100 text-blue-700',
  general: 'bg-slate-100 text-slate-700',
};

export default function ClarifyingReview({
  analysisId,
  projectId,
  questionsJson,
  documents,
  onFinalized,
  onDocumentsChanged,
  readOnly = false,
}: ClarifyingReviewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadVendor, setUploadVendor] = useState('');
  const [uploadDocType, setUploadDocType] = useState('supplemental');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [rerunNeeded, setRerunNeeded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/vendors')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setVendors(data))
      .catch(() => {});
  }, []);

  let questions: ClarifyingQuestion[] = [];
  try {
    questions = JSON.parse(questionsJson);
  } catch {
    questions = [];
  }

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleUseDefault = (questionId: string, defaultValue: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: defaultValue }));
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadVendor.trim()) return;
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('vendorName', uploadVendor.trim());
    formData.append('projectId', projectId);
    formData.append('documentType', uploadDocType);

    try {
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      setUploadFile(null);
      setUploadVendor('');
      setUploadDocType('supplemental');
      setRerunNeeded(true);
      onDocumentsChanged();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    setRerunNeeded(true);
    onDocumentsChanged();
  };

  const handleRerun = async () => {
    setFinalizing(true);
    setError('');
    try {
      // Re-trigger analysis from scratch (new parse + new questions)
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Re-analysis failed');
      }
      onDocumentsChanged(); // Refresh project state to pick up new analysis
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed');
    } finally {
      setFinalizing(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    setError('');
    try {
      const res = await fetch(`/api/analysis/${analysisId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Finalization failed');
      }
      onFinalized();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalization failed');
    } finally {
      setFinalizing(false);
    }
  };

  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;
  const activeDocs = documents.filter((d) => d.isActive !== false);

  return (
    <div className="space-y-6">
      {finalizing && <AnalysisLoadingOverlay />}
      {/* Header card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900 text-lg">Review Before Finalizing</h2>
            <p className="text-sm text-slate-600 mt-1">
              The AI has parsed all vendor proposals and identified {questions.length} item{questions.length !== 1 ? 's' : ''} that
              could benefit from your expertise. Answer as many as you&apos;d like — unanswered questions will
              use the AI&apos;s suggested defaults.
            </p>
          </div>
        </div>
      </div>

      {/* Document management section */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-900 text-sm">Documents Being Analyzed</h3>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="text-xs text-outsail-blue hover:text-outsail-blue-dark font-medium"
            >
              {showUpload ? 'Hide Upload' : '+ Add / Replace File'}
            </button>
          </div>

          {/* Current docs list */}
          <div className="space-y-2 mb-3">
            {activeDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-sm text-slate-700 truncate">{doc.fileName}</span>
                  <span className="text-xs text-slate-400">({doc.vendorName})</span>
                </div>
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {rerunNeeded && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-amber-700">
                Documents have changed. Re-run the analysis to update parsed data and questions.
              </p>
              <button
                onClick={handleRerun}
                disabled={finalizing}
                className="mt-2 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
              >
                {finalizing ? 'Re-analyzing...' : 'Re-run Analysis'}
              </button>
            </div>
          )}

          {/* Upload form */}
          {showUpload && (
            <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
                  <select
                    value={uploadVendor}
                    onChange={(e) => setUploadVendor(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none bg-white"
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none bg-white"
                  >
                    <option value="supplemental">Supplemental Info</option>
                    <option value="updated_quote">Updated/Revised Quote</option>
                    <option value="initial_quote">Initial Quote</option>
                  </select>
                </div>
              </div>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
                  uploadFile ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-slate-400'
                }`}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {uploadFile ? (
                  <p className="text-sm text-green-700">{uploadFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">Click to select a file</p>
                )}
              </div>
              {uploadError && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{uploadError}</div>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadVendor}
                className="w-full bg-outsail-blue-dark text-white py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q) => (
          <div
            key={q.id}
            className="bg-white rounded-xl border border-slate-200 p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[q.category] || categoryColors.general}`}>
                {categoryLabels[q.category] || q.category}
              </span>
              {q.vendorName && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-outsail-blue/10 text-outsail-blue-dark">
                  {q.vendorName}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-900 mb-1">{q.question}</p>
            <p className="text-xs text-slate-500 mb-3">{q.context}</p>

            {!readOnly && (
              <div>
                <textarea
                  rows={2}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  placeholder="Your answer or additional notes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-outsail-blue focus:border-outsail-blue outline-none resize-none"
                />
                {q.suggestedDefault && !answers[q.id]?.trim() && (
                  <button
                    onClick={() => handleUseDefault(q.id, q.suggestedDefault!)}
                    className="mt-1.5 text-xs text-outsail-blue hover:text-outsail-blue-dark"
                  >
                    Use AI suggestion: &ldquo;{q.suggestedDefault}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer actions */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {answeredCount} of {questions.length} questions answered
              {answeredCount < questions.length && ' — unanswered items will use AI defaults'}
            </p>
            <button
              onClick={handleFinalize}
              disabled={finalizing || rerunNeeded}
              className="bg-outsail-blue-dark text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
            >
              {finalizing ? 'Finalizing Analysis...' : 'Finalize Analysis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
