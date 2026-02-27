import * as XLSX from 'xlsx';
import { ComparisonTable, Citation } from '@/types';

export function generateExcelBuffer(
  comparisonData: ComparisonTable,
  standardizationNotes: string[],
  vendorNotes: Record<string, string[]>,
  nextSteps: string[],
  citations: Citation[],
  projectName: string
): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Comparison Table
  const compRows: (string | number | null)[][] = [];
  // Title row
  compRows.push([`${projectName} — Proposal Comparison`, ...comparisonData.vendors.map(() => '')]);
  // Header
  compRows.push(['Category', ...comparisonData.vendors]);
  if (comparisonData.normalizedHeadcount) {
    compRows.push(['Normalized to', ...comparisonData.vendors.map(() => `${comparisonData.normalizedHeadcount} employees`)]);
  }

  for (const section of comparisonData.sections) {
    compRows.push([section.name, ...comparisonData.vendors.map(() => '')]);
    for (const row of section.rows) {
      compRows.push([
        row.label,
        ...row.values.map((v) => (v.amount != null ? v.amount : v.display)),
      ]);
    }
  }

  const compSheet = XLSX.utils.aoa_to_sheet(compRows);
  // Set column widths
  compSheet['!cols'] = [
    { wch: 40 },
    ...comparisonData.vendors.map(() => ({ wch: 25 })),
  ];
  XLSX.utils.book_append_sheet(wb, compSheet, 'Comparison');

  // Sheet 2: Vendor Notes
  const vnRows: string[][] = [['Vendor', 'Note']];
  for (const [vendor, notes] of Object.entries(vendorNotes)) {
    for (const note of notes) {
      vnRows.push([vendor, note]);
    }
  }
  const vnSheet = XLSX.utils.aoa_to_sheet(vnRows);
  vnSheet['!cols'] = [{ wch: 25 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, vnSheet, 'Vendor Notes');

  // Sheet 3: Standardization Notes
  const snRows: string[][] = [['Standardization Notes']];
  for (const note of standardizationNotes) {
    snRows.push([note]);
  }
  const snSheet = XLSX.utils.aoa_to_sheet(snRows);
  snSheet['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, snSheet, 'Standardization');

  // Sheet 4: Next Steps
  const nsRows: string[][] = [['Next Steps']];
  for (const step of nextSteps) {
    nsRows.push([step]);
  }
  const nsSheet = XLSX.utils.aoa_to_sheet(nsRows);
  nsSheet['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, nsSheet, 'Next Steps');

  // Sheet 5: Citations
  const cRows: string[][] = [['Vendor', 'Document', 'Excerpt']];
  for (const c of citations) {
    cRows.push([c.vendorName, c.documentName, c.excerpt]);
  }
  const cSheet = XLSX.utils.aoa_to_sheet(cRows);
  cSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, cSheet, 'Citations');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}
