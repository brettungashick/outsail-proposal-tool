'use client';

import { ComparisonTable as ComparisonTableType, TableSection } from '@/types';
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
}

export default function ComparisonTable({ data, isEditable, onCellEdit }: ComparisonTableProps) {
  const sectionColors: Record<string, string> = {
    'Software Fees (Recurring)': 'bg-blue-600',
    'Implementation Fees (One-Time)': 'bg-emerald-600',
    'Service Fees (Recurring)': 'bg-purple-600',
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
              vendorCount={data.vendors.length}
              headerColor={sectionColors[section.name] || 'bg-slate-600'}
              isEditable={isEditable}
              onCellEdit={onCellEdit}
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
  vendorCount,
  headerColor,
  isEditable,
  onCellEdit,
}: {
  section: TableSection;
  sectionIndex: number;
  vendorCount: number;
  headerColor: string;
  isEditable: boolean;
  onCellEdit: (si: number, ri: number, vi: number, val: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={vendorCount + 1}
          className={`px-4 py-2.5 text-sm font-semibold text-white ${headerColor}`}
        >
          {section.name}
        </td>
      </tr>
      {section.rows.map((row, rowIdx) => (
        <tr
          key={row.id}
          className={row.isSubtotal ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50/50'}
        >
          <td className="px-4 py-2 border border-slate-200 text-sm text-slate-700">
            {row.label}
          </td>
          {row.values.map((val, vendorIdx) => (
            <EditableCell
              key={vendorIdx}
              value={val.display}
              isEditable={isEditable && !row.isSubtotal}
              isConfirmed={val.isConfirmed}
              note={val.note}
              onSave={(newVal) => onCellEdit(sectionIndex, rowIdx, vendorIdx, newVal)}
            />
          ))}
        </tr>
      ))}
    </>
  );
}
