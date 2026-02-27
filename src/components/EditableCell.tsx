'use client';

import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string;
  isEditable: boolean;
  isConfirmed: boolean;
  note: string | null;
  onSave: (newValue: string) => void;
}

export default function EditableCell({
  value,
  isEditable,
  isConfirmed,
  note,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setEditing(false);
    }
  };

  const lowerValue = value.toLowerCase();
  const isIncluded = lowerValue === 'included' || lowerValue === 'included in bundle';
  const isNotIncluded = lowerValue === 'not included';
  const isUnconfirmed = !isConfirmed;
  const isCurrency = /^\$[\d,]+/.test(value);

  // Determine cell styling based on value
  let cellBg = '';
  let textClass = 'text-slate-900';

  if (isIncluded) {
    cellBg = '';
    textClass = 'text-green-600';
  } else if (isNotIncluded) {
    cellBg = '';
    textClass = 'text-red-500';
  } else if (isUnconfirmed) {
    cellBg = 'bg-yellow-50';
    textClass = 'text-amber-700';
  }

  if (editing && isEditable) {
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
        isEditable ? 'cursor-pointer hover:bg-indigo-50/50' : ''
      }`}
      onClick={() => isEditable && setEditing(true)}
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
            {note && (
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
