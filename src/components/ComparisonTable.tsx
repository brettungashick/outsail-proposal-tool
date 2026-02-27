'use client';

import { ComparisonTable as ComparisonTableType, TableSection, DiscountToggles } from '@/types';
import EditableCell from './EditableCell';

interface ComparisonTableProps {
  data: ComparisonTableType;
  isEditable: boolean;
  onCellEdit: (
    sectionIndex: number,
    rowIndex: number,
    vendorIndex: number,
    newValue: string
  ) => void;
  discountToggles?: DiscountToggles;
  onDiscountToggle?: (vendorName: string, discountId: string, enabled: boolean) => void;
  vendorColors?: Record<string, string>;
}

export default function ComparisonTable({
  data,
  isEditable,
  onCellEdit,
  discountToggles,
  onDiscountToggle,
  vendorColors,
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
            <tr className="bg-indigo-50/50">
              <td className="px-4 py-1.5 text-xs text-indigo-500 border-b border-slate-100">
                Normalized to
              </td>
              {data.vendors.map((vendor) => (
                <td
                  key={vendor}
                  className="px-4 py-1.5 text-xs text-indigo-500 text-center border-b border-slate-100"
                >
                  {data.normalizedHeadcount} employees
                </td>
              ))}
            </tr>
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
            />
          ))}
        </tbody>
      </table>
    </div>
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
}: {
  section: TableSection;
  sectionIndex: number;
  vendors: string[];
  sectionStyle: { bg: string; text: string };
  isEditable: boolean;
  onCellEdit: (si: number, ri: number, vi: number, val: string) => void;
  discountToggles?: DiscountToggles;
  onDiscountToggle?: (vendorName: string, discountId: string, enabled: boolean) => void;
}) {
  const isDiscountSection = section.name === 'Discounts';

  return (
    <>
      <tr>
        <td
          colSpan={vendors.length + 1}
          className={`px-4 py-2.5 text-sm font-semibold ${sectionStyle.text} ${sectionStyle.bg} rounded-sm`}
        >
          {section.name}
        </td>
      </tr>
      {section.rows.map((row, rowIdx) => {
        const isDiscountRow = row.isDiscount;

        return (
          <tr
            key={row.id}
            className={`${
              row.isSubtotal
                ? 'bg-slate-50 font-semibold'
                : isDiscountRow
                  ? 'bg-amber-50/30'
                  : 'hover:bg-slate-50/50'
            } border-b border-slate-100`}
          >
            <td className="px-4 py-2.5 text-sm text-slate-700 border-r border-slate-100">
              <div className="flex items-center gap-2">
                {row.label}
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
                    isEditable={isEditable && !row.isSubtotal}
                    isConfirmed={val.isConfirmed}
                    note={val.note}
                    onSave={(newVal) => onCellEdit(sectionIndex, rowIdx, vendorIdx, newVal)}
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
