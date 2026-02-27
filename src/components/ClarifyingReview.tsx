'use client';

import { useState } from 'react';
import { ClarifyingQuestion } from '@/types';

interface ClarifyingReviewProps {
  analysisId: string;
  questionsJson: string;
  onFinalized: () => void;
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
  questionsJson,
  onFinalized,
  readOnly = false,
}: ClarifyingReviewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-6">
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
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
                {q.suggestedDefault && !answers[q.id]?.trim() && (
                  <button
                    onClick={() => handleUseDefault(q.id, q.suggestedDefault!)}
                    className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-800"
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
              disabled={finalizing}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {finalizing ? 'Finalizing Analysis...' : 'Finalize Analysis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
