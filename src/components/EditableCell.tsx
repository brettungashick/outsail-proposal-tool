'use client';

import { useState, useRef, useEffect } from 'react';
import { CellStatus, CellAudit } from '@/types';
import CellAuditTooltip from './CellAuditTooltip';

const STATUS_OPTIONS: { value: CellStatus; label: string }[] = [
  { value: 'tbc', label: 'To be confirmed' },
  { value: 'included', label: 'Included' },
  { value: 'included_in_bundle', label: 'Included in bundle' },
  { value: 'not_included', label: 'Not included' },
  { value: 'na', label: 'N/A' },
  { value: 'hidden', label: 'Hidden' },
];

interface EditableCellProps {
  value: string;
  isEditable: boolean;
  isConfirmed: boolean;
  isComputed?: boolean;
  note: string | null;
  status?: CellStatus;
  audit?: CellAudit;
  onSave: (newDisplay: string, newAmount: number | null) => void;
  onStatusChange?: (status: CellStatus) => void;
  onAuditClick?: () => void;
}

export default function EditableCell({
  value,
  isEditable,
  isConfirmed,
  isComputed,
  note,
  status,
  audit,
  onSave,
  onStatusChange,
  onAuditClick,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const cleaned = editValue.replace(/[$,]/g, '').replace(/\/yr$/i, '').trim();
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        onSave(editValue, parsed);
      } else {
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

  const handleStatusSelect = (newStatus: CellStatus) => {
    setEditing(false);
    if (onStatusChange) {
      onStatusChange(newStatus);
    } else {
      // Fallback: convert status to display string
      const displayMap: Record<CellStatus, string> = {
        currency: value,
        tbc: 'To be confirmed',
        included: 'Included',
        included_in_bundle: 'Included in bundle',
        not_included: 'Not included',
        na: 'N/A',
        hidden: 'Hidden',
      };
      onSave(displayMap[newStatus], null);
    }
  };

  // Determine visual state from status (with display-string fallback for old data)
  const lowerValue = value.toLowerCase().trim();
  const isIncluded = status
    ? status === 'included' || status === 'included_in_bundle'
    : lowerValue === 'included' || lowerValue === 'included in bundle';
  const isNotIncluded = status
    ? status === 'not_included' || status === 'na'
    : lowerValue === 'not included' || lowerValue === 'n/a';
  const isHidden = status ? status === 'hidden' : lowerValue === 'hidden';
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
      <div className="px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="$0"
          className="w-full px-2 py-1 border border-indigo-400 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-1"
        />
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              handleStatusSelect(e.target.value as CellStatus);
            }
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-500 bg-white cursor-pointer"
        >
          <option value="" disabled>Or set status...</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className={`px-3 py-2.5 text-sm text-center ${cellBg} ${
        canEdit ? 'cursor-pointer hover:bg-indigo-50/50' : ''
      } ${isComputed ? 'bg-slate-50/50' : ''} group/cell relative`}
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
        {audit && (audit.sources.length > 0 || audit.override || audit.formula) && onAuditClick && (
          <span className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); onAuditClick(); }}
              onMouseEnter={() => {
                tooltipTimer.current = setTimeout(() => setShowTooltip(true), 200);
              }}
              onMouseLeave={() => {
                if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                setShowTooltip(false);
              }}
              className="opacity-0 group-hover/cell:opacity-100 ml-0.5 text-slate-400 hover:text-indigo-500 transition"
              title=""
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </button>
            {showTooltip && <CellAuditTooltip audit={audit} />}
          </span>
        )}
      </div>
    </div>
  );
}
