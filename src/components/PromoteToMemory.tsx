'use client';

import { useState, useEffect, useCallback } from 'react';

interface PromoteToMemoryProps {
  event: {
    eventId?: string;
    vendorName: string;
    sectionName: string;
    rowLabel: string;
    editType: 'status_change' | 'label_change' | 'value_change';
    oldDisplay: string;
    newDisplay: string;
    oldStatus?: string;
    newStatus?: string;
  } | null;
  onDismiss: () => void;
}

export default function PromoteToMemory({ event, onDismiss }: PromoteToMemoryProps) {
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [error, setError] = useState('');

  // Auto-dismiss after 8 seconds if user doesn't interact
  useEffect(() => {
    if (!event || promoted) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [event, promoted, onDismiss]);

  const handlePromote = useCallback(async () => {
    if (!event) return;
    setPromoting(true);
    setError('');

    try {
      // Build rule from the edit event
      const isStatusChange = event.editType === 'status_change';
      const conditionField = isStatusChange ? 'label' : 'label';
      const conditionValue = event.rowLabel;
      const actionType = isStatusChange ? 'set_status' : 'add_note';
      const actionValue = isStatusChange
        ? JSON.stringify(event.newStatus || event.newDisplay)
        : JSON.stringify(`Renamed from "${event.oldDisplay}"`);

      const ruleName = isStatusChange
        ? `Set "${conditionValue}" to ${event.newDisplay}`
        : `Note: "${event.oldDisplay}" → "${event.newDisplay}"`;

      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: event.vendorName || '*',
          name: ruleName.slice(0, 100),
          conditionType: 'contains',
          conditionValue,
          conditionField,
          actionType,
          actionValue,
          examples: JSON.stringify([
            { section: event.sectionName, label: event.rowLabel, old: event.oldDisplay, new: event.newDisplay },
          ]),
          confidence: 'sure',
          createdFromEventId: event.eventId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create rule');
      }

      const rule = await res.json();

      // Link the learning event to the new rule
      if (event.eventId) {
        fetch(`/api/learning-events/${event.eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotedToRuleId: rule.id }),
        }).catch(() => {});
      }

      setPromoted(true);
      setTimeout(onDismiss, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setPromoting(false);
    }
  }, [event, onDismiss]);

  if (!event) return null;

  const isStatusChange = event.editType === 'status_change';
  const description = isStatusChange
    ? `"${event.rowLabel}" → ${event.newDisplay}`
    : `"${event.oldDisplay}" → "${event.newDisplay}"`;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4 max-w-sm">
        {promoted ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Rule saved to playbooks
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">Remember this correction?</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate" title={description}>
                  {description}
                </p>
                {event.vendorName && (
                  <p className="text-xs text-slate-400 mt-0.5">{event.vendorName}</p>
                )}
              </div>
              <button
                onClick={onDismiss}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-500 mt-2">{error}</p>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={onDismiss}
                className="flex-1 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
              >
                One-time
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="flex-1 text-xs text-white bg-outsail-blue-dark px-3 py-1.5 rounded-lg hover:bg-outsail-navy transition disabled:opacity-50"
              >
                {promoting ? 'Saving...' : 'Always apply'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
