'use client';

import { useState } from 'react';

interface NotesSectionProps {
  standardizationNotes: string[];
  vendorNotes: Record<string, string[]>;
  nextSteps: string[];
  isEditable: boolean;
  onUpdateStandardization: (notes: string[]) => void;
  onUpdateVendorNotes: (notes: Record<string, string[]>) => void;
  onUpdateNextSteps: (steps: string[]) => void;
}

export default function NotesSection({
  standardizationNotes,
  vendorNotes,
  nextSteps,
  isEditable,
  onUpdateStandardization,
  onUpdateVendorNotes,
  onUpdateNextSteps,
}: NotesSectionProps) {
  return (
    <div className="space-y-6">
      {/* Standardization Changes */}
      <NotesBlock
        title="1. Standardization Changes"
        description="Adjustments made to achieve an apples-to-apples comparison"
        notes={standardizationNotes}
        isEditable={isEditable}
        onUpdate={onUpdateStandardization}
        color="blue"
      />

      {/* Vendor-Specific Notes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <h3 className="font-semibold text-amber-900">2. Vendor-Specific Notes</h3>
          <p className="text-xs text-amber-700 mt-0.5">
            Discrepancies, gaps, and remaining unknowns per vendor
          </p>
        </div>
        <div className="p-6 space-y-4">
          {Object.entries(vendorNotes).map(([vendor, notes]) => (
            <VendorNotesBlock
              key={vendor}
              vendorName={vendor}
              notes={notes}
              isEditable={isEditable}
              onUpdate={(updatedNotes) => {
                onUpdateVendorNotes({ ...vendorNotes, [vendor]: updatedNotes });
              }}
            />
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <NotesBlock
        title="3. Suggested Next Steps"
        description="Recommended actions for the client"
        notes={nextSteps}
        isEditable={isEditable}
        onUpdate={onUpdateNextSteps}
        color="green"
      />
    </div>
  );
}

function NotesBlock({
  title,
  description,
  notes,
  isEditable,
  onUpdate,
  color,
}: {
  title: string;
  description: string;
  notes: string[];
  isEditable: boolean;
  onUpdate: (notes: string[]) => void;
  color: 'blue' | 'green';
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-900', desc: 'text-blue-700' },
    green: { bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-900', desc: 'text-green-700' },
  };
  const c = colorClasses[color];

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditValue(notes[index]);
  };

  const saveEdit = () => {
    if (editIndex !== null) {
      const updated = [...notes];
      updated[editIndex] = editValue;
      onUpdate(updated);
      setEditIndex(null);
    }
  };

  const addNote = () => {
    onUpdate([...notes, 'New note — click to edit']);
    setTimeout(() => startEdit(notes.length), 50);
  };

  const removeNote = (index: number) => {
    onUpdate(notes.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-6 py-4 ${c.bg} border-b ${c.border}`}>
        <h3 className={`font-semibold ${c.title}`}>{title}</h3>
        <p className={`text-xs ${c.desc} mt-0.5`}>{description}</p>
      </div>
      <div className="p-6">
        <ul className="space-y-2">
          {notes.map((note, idx) => (
            <li key={idx} className="flex items-start gap-2 group">
              <span className="text-slate-400 mt-0.5">•</span>
              {editIndex === idx && isEditable ? (
                <input
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') setEditIndex(null);
                  }}
                  className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              ) : (
                <span
                  className={`flex-1 text-sm text-slate-700 ${isEditable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  onClick={() => isEditable && startEdit(idx)}
                >
                  {note}
                </span>
              )}
              {isEditable && editIndex !== idx && (
                <button
                  onClick={() => removeNote(idx)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {isEditable && (
          <button
            onClick={addNote}
            className="mt-3 text-xs text-blue-500 hover:text-blue-700 transition"
          >
            + Add note
          </button>
        )}
      </div>
    </div>
  );
}

function VendorNotesBlock({
  vendorName,
  notes,
  isEditable,
  onUpdate,
}: {
  vendorName: string;
  notes: string[];
  isEditable: boolean;
  onUpdate: (notes: string[]) => void;
}) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (index: number) => {
    setEditIndex(index);
    setEditValue(notes[index]);
  };

  const saveEdit = () => {
    if (editIndex !== null) {
      const updated = [...notes];
      updated[editIndex] = editValue;
      onUpdate(updated);
      setEditIndex(null);
    }
  };

  const addNote = () => {
    onUpdate([...notes, 'New note — click to edit']);
  };

  const removeNote = (index: number) => {
    onUpdate(notes.filter((_, i) => i !== index));
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <h4 className="font-medium text-slate-800 text-sm mb-2">{vendorName}</h4>
      <ul className="space-y-1.5">
        {notes.map((note, idx) => (
          <li key={idx} className="flex items-start gap-2 group">
            <span className="text-slate-400 mt-0.5 text-sm">–</span>
            {editIndex === idx && isEditable ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') setEditIndex(null);
                }}
                className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <span
                className={`flex-1 text-sm text-slate-600 ${isEditable ? 'cursor-pointer hover:text-blue-600' : ''}`}
                onClick={() => isEditable && startEdit(idx)}
              >
                {note}
              </span>
            )}
            {isEditable && editIndex !== idx && (
              <button
                onClick={() => removeNote(idx)}
                className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {isEditable && (
        <button
          onClick={addNote}
          className="mt-2 text-xs text-blue-500 hover:text-blue-700 transition"
        >
          + Add note
        </button>
      )}
    </div>
  );
}
