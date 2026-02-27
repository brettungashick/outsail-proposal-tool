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
}

export default function ComparisonTable({
  data,
  isEditable,
  onCellEdit,
  discountToggles,
  onDiscountToggle,
}: ComparisonTableProps) {
  const sectionColors: Record<string, string> = {
    'Software Fees (Recurring)': 'bg-blue-600',
    'Implementation Fees (One-Time)': 'bg-emerald-600',
    'Service Fees (Recurring)': 'bg-purple-600',
    Discounts: 'bg-amber-600',
    Totals: 'bg-slate-800',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border border-slate-200 w-64">
              Category
            </th>
            {data.vendors.map((vendor) => (
              <th
                key={vendor}
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border border-slate-200 min-w-[180px]"
              >
                {vendor}
              </th>
            ))}
          </tr>
          {data.normalizedHeadcount && (
            <tr className="bg-slate-50">
              <td className="px-4 py-1.5 text-xs text-slate-500 border border-slate-200">
                Normalized to
              </td>
              {data.vendors.map((vendor) => (
                <td
                  key={vendor}
                  className="px-4 py-1.5 text-xs text-slate-500 border border-slate-200"
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
              headerColor={sectionColors[section.name] || 'bg-slate-600'}
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
  headerColor,
  isEditable,
  onCellEdit,
  discountToggles,
  onDiscountToggle,
}: {
  section: TableSection;
  sectionIndex: number;
  vendors: string[];
  headerColor: string;
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
          className={`px-4 py-2.5 text-sm font-semibold text-white ${headerColor}`}
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
            }`}
          >
            <td className="px-4 py-2 border border-slate-200 text-sm text-slate-700">
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
              // Check if this discount is toggled off
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
                  className={`border border-slate-200 ${isToggledOff ? 'opacity-40 line-through' : ''}`}
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
  // Show a small toggle for each vendor
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
