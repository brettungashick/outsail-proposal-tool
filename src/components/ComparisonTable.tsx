'use client';

import { useState } from 'react';
import { ComparisonTable as ComparisonTableType, TableSection, DiscountToggles, HiddenRows } from '@/types';
import EditableCell from './EditableCell';

interface ComparisonTableProps {
  data: ComparisonTableType;
  isEditable: boolean;
  onCellEdit: (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newDisplay: string,
    newAmount: number | null
  ) => void;
  discountToggles?: DiscountToggles;
  onDiscountToggle?: (vendorName: string, discountId: string, enabled: boolean) => void;
  hiddenRows?: HiddenRows;
  onToggleHidden?: (rowId: string) => void;
  vendorColors?: Record<string, string>;
  onAddRow?: (sectionIndex: number) => void;
  onDeleteRow?: (sectionIndex: number, rowIndex: number) => void;
  onHeadcountChange?: (newHeadcount: number) => void;
}

const TOTALS_SECTION = 'Totals';

export default function ComparisonTable({
  data,
  isEditable,
  onCellEdit,
  discountToggles,
  onDiscountToggle,
  hiddenRows,
  onToggleHidden,
  vendorColors,
  onAddRow,
  onDeleteRow,
  onHeadcountChange,
}: ComparisonTableProps) {
  const sectionColors: Record<string, { bg: string; text: string }> = {
    'Software Fees (Recurring)': { bg: 'bg-indigo-700', text: 'text-white' },
    'Implementation Fees (One-Time)': { bg: 'bg-emerald-700', text: 'text-white' },
    'Service Fees (Recurring)': { bg: 'bg-purple-700', text: 'text-white' },
    'Modules Included': { bg: 'bg-indigo-700', text: 'text-white' },
    Discounts: { bg: 'bg-amber-600', text: 'text-white' },
    Totals: { bg: 'bg-slate-800', text: 'text-white' },
  };

  return (
    <div className="overflow-x-auto">
      {/* Vendor header cards */}
      <div className="flex gap-4 mb-4 pl-64">
        {data.vendors.map((vendor) => {
          const color = vendorColors?.[vendor] || '#4F46E5';
          return (
            <div
              key={vendor}
              className="flex-1 min-w-[160px] bg-white rounded-xl border border-slate-200 p-4 text-center"
            >
              <div
                className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: color }}
              >
                {vendor.substring(0, 2).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-slate-900">{vendor}</p>
            </div>
          );
        })}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white w-64 border-b border-slate-200">
              Category
            </th>
            {data.vendors.map((vendor) => (
              <th
                key={vendor}
                className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider bg-white border-b border-slate-200 min-w-[160px]"
              >
                {vendor}
              </th>
            ))}
          </tr>
          {data.normalizedHeadcount && (
            <HeadcountRow
              headcount={data.normalizedHeadcount}
              vendorCount={data.vendors.length}
              isEditable={isEditable && !!onHeadcountChange}
              onHeadcountChange={onHeadcountChange}
            />
          )}
        </thead>
        <tbody>
          {data.sections.map((section, sectionIdx) => (
            <SectionBlock
              key={section.name}
              section={section}
              sectionIndex={sectionIdx}
              vendors={data.vendors}
              sectionStyle={sectionColors[section.name] || { bg: 'bg-slate-600', text: 'text-white' }}
              isEditable={isEditable}
              onCellEdit={onCellEdit}
              discountToggles={discountToggles}
              onDiscountToggle={onDiscountToggle}
              hiddenRows={hiddenRows}
              onToggleHidden={onToggleHidden}
              onAddRow={onAddRow}
              onDeleteRow={onDeleteRow}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeadcountRow({
  headcount,
  vendorCount,
  isEditable,
  onHeadcountChange,
}: {
  headcount: number;
  vendorCount: number;
  isEditable: boolean;
  onHeadcountChange?: (newHeadcount: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(headcount));

  const handleSave = () => {
    setEditing(false);
    const parsed = parseInt(draft.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== headcount) {
      onHeadcountChange?.(parsed);
    } else {
      setDraft(String(headcount));
    }
  };

  return (
    <tr className="bg-indigo-50/50">
      <td className="px-4 py-1.5 text-xs text-indigo-500 border-b border-slate-100">
        Normalized to
      </td>
      {Array.from({ length: vendorCount }).map((_, i) => (
        <td
          key={i}
          className="px-4 py-1.5 text-xs text-indigo-500 text-center border-b border-slate-100"
        >
          {isEditable && editing ? (
            <input
              className="w-20 px-1.5 py-0.5 text-xs text-center border border-indigo-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setDraft(String(headcount));
                  setEditing(false);
                }
              }}
              autoFocus={i === 0}
            />
          ) : (
            <span
              className={isEditable ? 'cursor-pointer hover:underline' : ''}
              onClick={() => {
                if (isEditable) {
                  setDraft(String(headcount));
                  setEditing(true);
                }
              }}
            >
              {headcount} employees
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

function SectionBlock({
  section,
  sectionIndex,
  vendors,
  sectionStyle,
  isEditable,
  onCellEdit,
  discountToggles,
  onDiscountToggle,
  hiddenRows,
  onToggleHidden,
  onAddRow,
  onDeleteRow,
}: {
  section: TableSection;
  sectionIndex: number;
  vendors: string[];
  sectionStyle: { bg: string; text: string };
  isEditable: boolean;
  onCellEdit: (si: number, ri: number, vi: number, display: string, amount: number | null) => void;
  discountToggles?: DiscountToggles;
  onDiscountToggle?: (vendorName: string, discountId: string, enabled: boolean) => void;
  hiddenRows?: HiddenRows;
  onToggleHidden?: (rowId: string) => void;
  onAddRow?: (sectionIndex: number) => void;
  onDeleteRow?: (sectionIndex: number, rowIndex: number) => void;
}) {
  const isDiscountSection = section.name === 'Discounts';
  const isTotalsSection = section.name === TOTALS_SECTION;

  return (
    <>
      <tr>
        <td
          colSpan={vendors.length + 1}
          className={`px-4 py-2.5 text-sm font-semibold ${sectionStyle.text} ${sectionStyle.bg} rounded-sm`}
        >
          <div className="flex items-center justify-between">
            <span>{section.name}</span>
            {isEditable && !isTotalsSection && onAddRow && (
              <button
                onClick={() => onAddRow(sectionIndex)}
                className="text-white/70 hover:text-white text-xs font-medium transition"
                title={`Add row to ${section.name}`}
              >
                + Add
              </button>
            )}
          </div>
        </td>
      </tr>
      {section.rows.map((row, rowIdx) => {
        const isDiscountRow = row.isDiscount;
        const isComputed = row.isSubtotal || isTotalsSection;
        const canEditCell = isEditable && !isComputed;
        const canDelete = isEditable && !row.isSubtotal && !isTotalsSection;
        const isRowHidden = hiddenRows?.[row.id] === true;

        return (
          <tr
            key={row.id}
            className={`group ${
              isRowHidden
                ? 'opacity-40 bg-slate-50/50'
                : row.isSubtotal
                  ? 'bg-slate-50 font-semibold'
                  : isDiscountRow
                    ? 'bg-amber-50/30'
                    : 'hover:bg-slate-50/50'
            } border-b border-slate-100`}
          >
            <td className="px-4 py-2.5 text-sm text-slate-700 border-r border-slate-100">
              <div className="flex items-center gap-2">
                {canDelete && onDeleteRow && (
                  <button
                    onClick={() => onDeleteRow(sectionIndex, rowIdx)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 flex-shrink-0 transition"
                    title="Delete row"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {isEditable && !row.isSubtotal && !isTotalsSection && onToggleHidden && (
                  <button
                    onClick={() => onToggleHidden(row.id)}
                    className={`opacity-0 group-hover:opacity-100 flex-shrink-0 transition ${
                      isRowHidden ? 'text-slate-500 opacity-100' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title={isRowHidden ? 'Show row (include in calculations)' : 'Hide row (exclude from calculations)'}
                  >
                    {isRowHidden ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                )}
                <span className={isRowHidden ? 'line-through' : ''}>{row.label}</span>
                {isDiscountSection && isDiscountRow && onDiscountToggle && (
                  <DiscountToggleButtons
                    rowId={row.id}
                    vendors={vendors}
                    discountToggles={discountToggles}
                    onToggle={onDiscountToggle}
                  />
                )}
              </div>
            </td>
            {row.values.map((val, vendorIdx) => {
              let isToggledOff = false;
              if (isDiscountSection && isDiscountRow && discountToggles) {
                const vendorName = vendors[vendorIdx];
                const toggleState = discountToggles[vendorName]?.[row.id];
                if (toggleState === false) {
                  isToggledOff = true;
                }
              }

              return (
                <td
                  key={vendorIdx}
                  className={`border-r border-slate-100 ${isToggledOff ? 'opacity-40 line-through' : ''}`}
                >
                  <EditableCell
                    value={val.display}
                    isEditable={canEditCell}
                    isConfirmed={val.isConfirmed}
                    isComputed={isComputed}
                    note={val.note}
                    onSave={(newDisplay, newAmount) =>
                      onCellEdit(sectionIndex, rowIdx, vendorIdx, newDisplay, newAmount)
                    }
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function DiscountToggleButtons({
  rowId,
  vendors,
  discountToggles,
  onToggle,
}: {
  rowId: string;
  vendors: string[];
  discountToggles?: DiscountToggles;
  onToggle: (vendorName: string, discountId: string, enabled: boolean) => void;
}) {
  return (
    <div className="flex gap-1 ml-2">
      {vendors.map((vendor) => {
        const isEnabled = discountToggles?.[vendor]?.[rowId] !== false;
        return (
          <button
            key={vendor}
            onClick={() => onToggle(vendor, rowId, !isEnabled)}
            className={`w-5 h-5 rounded text-xs font-bold transition ${
              isEnabled
                ? 'bg-amber-500 text-white'
                : 'bg-slate-200 text-slate-400'
            }`}
            title={`${isEnabled ? 'Disable' : 'Enable'} discount for ${vendor}`}
          >
            {vendor.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}
