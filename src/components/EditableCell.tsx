'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  isEditable: boolean;
  isConfirmed: boolean;
  isComputed?: boolean;
  note: string | null;
  onSave: (newDisplay: string, newAmount: number | null) => void;
}

export default function EditableCell({
  value,
  isEditable,
  isConfirmed,
  isComputed,
  note,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      // Parse as number, stripping currency formatting
      const cleaned = editValue.replace(/[$,]/g, '').replace(/\/yr$/i, '').trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        onSave(editValue, parsed);
      } else {
        // Non-numeric (e.g., "Included", "Not included")
        onSave(editValue, null);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditing(false);
    }
  };

  const lowerValue = value.toLowerCase().trim();
  const isIncluded = lowerValue === 'included' || lowerValue === 'included in bundle';
  const isNotIncluded = lowerValue === 'not included';
  const isHidden = lowerValue === 'hidden';
  const isUnconfirmed = !isConfirmed && !isHidden;
  const isCurrency = /^-?\$[\d,]+/.test(value);

  let cellBg = '';
  let textClass = 'text-slate-900';

  if (isHidden) {
    cellBg = 'bg-slate-50';
    textClass = 'text-slate-400 italic';
  } else if (isIncluded) {
    cellBg = '';
    textClass = 'text-green-600';
  } else if (isNotIncluded) {
    cellBg = '';
    textClass = 'text-red-500';
  } else if (isUnconfirmed) {
    cellBg = 'bg-yellow-50';
    textClass = 'text-amber-700';
  }

  const canEdit = isEditable && !isComputed;

  if (editing && canEdit) {
    return (
      <div className="px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border border-indigo-400 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`px-3 py-2.5 text-sm text-center ${cellBg} ${
        canEdit ? 'cursor-pointer hover:bg-indigo-50/50' : ''
      } ${isComputed ? 'bg-slate-50/50' : ''}`}
      onClick={() => canEdit && setEditing(true)}
      title={note || undefined}
    >
      <div className="flex items-center justify-center gap-1.5">
        {isIncluded ? (
          <>
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className={textClass}>{value}</span>
          </>
        ) : isNotIncluded ? (
          <>
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className={textClass}>{value}</span>
          </>
        ) : (
          <>
            <span className={`${textClass} ${isCurrency ? 'font-medium' : ''}`}>{value}</span>
            {isComputed && (
              <span title="Auto-calculated">
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.25-4.5h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5v-.008zm2.25-6.75h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75v-.008zm2.25-4.5h.008v.008H15v-.008zm0 2.25h.008v.008H15v-.008zm3.75-12v16.5a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0020.25 4.5H3.75A2.25 2.25 0 001.5 6.75m19.5 0v1.5" />
                </svg>
              </span>
            )}
            {note && !isComputed && (
              <span className="text-xs text-amber-500" title={note}>
                *
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
