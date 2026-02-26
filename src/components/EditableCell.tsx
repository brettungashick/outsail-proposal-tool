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

  const bgColor = !isConfirmed
    ? 'bg-yellow-50'
    : value === 'Not included'
      ? 'bg-slate-50'
      : value === 'Included in bundle'
        ? 'bg-blue-50'
        : '';

  if (editing && isEditable) {
    return (
      <td className="px-3 py-2 border border-slate-200">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </td>
    );
  }

  return (
    <td
      className={`px-3 py-2 border border-slate-200 text-sm ${bgColor} ${
        isEditable ? 'cursor-pointer hover:bg-blue-50/50' : ''
      }`}
      onClick={() => isEditable && setEditing(true)}
      title={note || undefined}
    >
      <div className="flex items-center gap-1">
        <span className={!isConfirmed ? 'text-amber-700' : 'text-slate-900'}>{value}</span>
        {note && (
          <span className="text-xs text-amber-500 ml-1" title={note}>
            *
          </span>
        )}
      </div>
    </td>
  );
}
