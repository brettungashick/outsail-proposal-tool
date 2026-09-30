import { createHash } from 'crypto';
import { AnalysisResult, ComparisonTable, DiscountToggles, HiddenRows, TableRow, VendorValue } from '@/types';

/**
 * Helpers for feedback-driven revisions. A revision regenerates the whole
 * analysis, so everything here works on "before" and "after" snapshots:
 * diffing them for the advisor's preview, and carrying over state (manual
 * overrides, audit trails, toggles) the model doesn't know about.
 */

export interface PendingRevision {
  feedback: string;
  result: AnalysisResult;
  changeSummary: string[];
  /** sha256 of the comparisonData the revision was built from. */
  baseHash: string;
  createdBy: string;
  createdAt: string;
}

export interface RevisionHistoryEntry {
  feedback: string;
  changeSummary: string[];
  basedOnVersion: number;
  createdBy: string;
  createdAt: string;
}

export interface CellChange {
  vendor: string;
  before: string;
  after: string;
}

export interface RowChange {
  rowId: string;
  label: string;
  previousLabel?: string;
  cells: CellChange[];
  /** Subtotal, PEPM or Totals row: its values follow from other rows. */
  computed?: boolean;
}

export interface SectionDiff {
  name: string;
  added: { rowId: string; label: string; cells: { vendor: string; display: string }[] }[];
  removed: { rowId: string; label: string }[];
  changed: RowChange[];
}

export interface ListDiff {
  added: string[];
  removed: string[];
}

export interface AnalysisDiff {
  sections: SectionDiff[];
  addedSections: string[];
  removedSections: string[];
  headcount: { before: number; after: number } | null;
  standardizationNotes: ListDiff;
  vendorNotes: Record<string, ListDiff>;
  nextSteps: ListDiff;
  /** Number of individual changes, for the preview header. Excludes recalculated rows. */
  changeCount: number;
}

function isComputedRow(sectionName: string, row: TableRow): boolean {
  return sectionName === 'Totals' || !!row.isSubtotal || !!row.isSectionSubtotal || !!row.isPepm;
}

function cellKey(value: VendorValue | undefined): string {
  if (!value) return '';
  return `${value.display ?? ''}|${value.amount ?? ''}`;
}

function listDiff(before: string[] = [], after: string[] = []): ListDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((item) => !beforeSet.has(item)),
    removed: before.filter((item) => !afterSet.has(item)),
  };
}

/** Match rows by id first, then by label for rows the model re-keyed. */
function matchRows(beforeRows: TableRow[], afterRows: TableRow[]) {
  const beforeById = new Map(beforeRows.map((r) => [r.id, r]));
  const matched = new Map<TableRow, TableRow>(); // after -> before
  const used = new Set<TableRow>();

  for (const row of afterRows) {
    const prior = beforeById.get(row.id);
    if (prior && !used.has(prior)) {
      matched.set(row, prior);
      used.add(prior);
    }
  }
  for (const row of afterRows) {
    if (matched.has(row)) continue;
    const prior = beforeRows.find(
      (r) => !used.has(r) && r.label.trim().toLowerCase() === row.label.trim().toLowerCase()
    );
    if (prior) {
      matched.set(row, prior);
      used.add(prior);
    }
  }
  return { matched, unmatchedBefore: beforeRows.filter((r) => !used.has(r)) };
}

/** Index vendor columns by name so a reordered vendor list doesn't read as every cell changing. */
function vendorCell(table: ComparisonTable, row: TableRow, vendor: string): VendorValue | undefined {
  const index = table.vendors.indexOf(vendor);
  return index >= 0 ? row.values[index] : undefined;
}

export function diffAnalyses(before: AnalysisResult, after: AnalysisResult): AnalysisDiff {
  const beforeTable = before.comparisonTable;
  const afterTable = after.comparisonTable;
  const vendors = Array.from(new Set([...beforeTable.vendors, ...afterTable.vendors]));
  const sections: SectionDiff[] = [];
  let changeCount = 0;

  const beforeSections = new Map(beforeTable.sections.map((s) => [s.name, s]));
  const afterNames = new Set(afterTable.sections.map((s) => s.name));

  for (const section of afterTable.sections) {
    const prior = beforeSections.get(section.name);
    if (!prior) continue;

    const { matched, unmatchedBefore } = matchRows(prior.rows, section.rows);
    const diff: SectionDiff = { name: section.name, added: [], removed: [], changed: [] };

    for (const row of section.rows) {
      const priorRow = matched.get(row);
      if (!priorRow) {
        diff.added.push({
          rowId: row.id,
          label: row.label,
          cells: afterTable.vendors.map((vendor, i) => ({ vendor, display: row.values[i]?.display ?? '' })),
        });
        continue;
      }

      const cells: CellChange[] = [];
      for (const vendor of vendors) {
        const b = vendorCell(beforeTable, priorRow, vendor);
        const a = vendorCell(afterTable, row, vendor);
        if (cellKey(b) !== cellKey(a)) {
          cells.push({ vendor, before: b?.display ?? '—', after: a?.display ?? '—' });
        }
      }
      const renamed = priorRow.label !== row.label;
      if (cells.length || renamed) {
        const computed = isComputedRow(section.name, row);
        diff.changed.push({
          rowId: row.id,
          label: row.label,
          ...(renamed ? { previousLabel: priorRow.label } : {}),
          cells,
          ...(computed ? { computed } : {}),
        });
      }
    }

    diff.removed = unmatchedBefore.map((r) => ({ rowId: r.id, label: r.label }));

    const count =
      diff.added.length +
      diff.removed.length +
      diff.changed
        .filter((r) => !r.computed)
        .reduce((n, r) => n + r.cells.length + (r.previousLabel ? 1 : 0), 0);
    if (diff.added.length || diff.removed.length || diff.changed.length) {
      sections.push(diff);
      changeCount += count;
    }
  }

  const addedSections = afterTable.sections.filter((s) => !beforeSections.has(s.name)).map((s) => s.name);
  const removedSections = beforeTable.sections.filter((s) => !afterNames.has(s.name)).map((s) => s.name);
  changeCount += addedSections.length + removedSections.length;

  const headcount =
    beforeTable.normalizedHeadcount !== afterTable.normalizedHeadcount
      ? { before: beforeTable.normalizedHeadcount, after: afterTable.normalizedHeadcount }
      : null;
  if (headcount) changeCount++;

  const standardizationNotes = listDiff(before.standardizationNotes, after.standardizationNotes);
  const nextSteps = listDiff(before.nextSteps, after.nextSteps);
  const vendorNotes: Record<string, ListDiff> = {};
  const noteVendors = new Set([
    ...Object.keys(before.vendorNotes || {}),
    ...Object.keys(after.vendorNotes || {}),
  ]);
  for (const vendor of Array.from(noteVendors)) {
    const d = listDiff(before.vendorNotes?.[vendor], after.vendorNotes?.[vendor]);
    if (d.added.length || d.removed.length) vendorNotes[vendor] = d;
  }

  for (const d of [standardizationNotes, nextSteps, ...Object.values(vendorNotes)]) {
    changeCount += d.added.length + d.removed.length;
  }

  return {
    sections,
    addedSections,
    removedSections,
    headcount,
    standardizationNotes,
    vendorNotes,
    nextSteps,
    changeCount,
  };
}

/**
 * Copy state the model doesn't round-trip back onto the revised table: manual
 * override flags, cell status and audit trails on cells whose value didn't
 * change, plus table-level settings like headcount growth and the audit log.
 * Returns a new table.
 */
export function carryForwardTableState(before: ComparisonTable, after: ComparisonTable): ComparisonTable {
  const result = structuredClone(after);

  if (result.headcountGrowthY2 === undefined && before.headcountGrowthY2 !== undefined) {
    result.headcountGrowthY2 = before.headcountGrowthY2;
  }
  if (result.headcountGrowthY3 === undefined && before.headcountGrowthY3 !== undefined) {
    result.headcountGrowthY3 = before.headcountGrowthY3;
  }
  if (before.auditLog) result.auditLog = before.auditLog;

  const beforeSections = new Map(before.sections.map((s) => [s.name, s]));
  for (const section of result.sections) {
    const prior = beforeSections.get(section.name);
    if (!prior) continue;
    const { matched } = matchRows(prior.rows, section.rows);

    for (const row of section.rows) {
      const priorRow = matched.get(row);
      if (!priorRow) continue;

      result.vendors.forEach((vendor, i) => {
        const priorCell = vendorCell(before, priorRow, vendor);
        const cell = row.values[i];
        if (!priorCell || !cell) return;

        if (cellKey(priorCell) === cellKey(cell)) {
          if (priorCell.isManualOverride) cell.isManualOverride = true;
          if (priorCell.status && !cell.status) cell.status = priorCell.status;
          if (priorCell.audit && !cell.audit) cell.audit = priorCell.audit;
        } else {
          // The model changed a hand-set cell, so it's no longer a manual override.
          delete cell.isManualOverride;
        }
      });
    }
  }

  return result;
}

/** Drop discount toggles and hidden-row flags that point at rows the revision removed. */
export function filterStateToRows(
  discountToggles: DiscountToggles,
  hiddenRows: HiddenRows,
  table: ComparisonTable
): { discountToggles: DiscountToggles; hiddenRows: HiddenRows } {
  const rowIds = new Set(table.sections.flatMap((s) => s.rows.map((r) => r.id)));
  const vendors = new Set(table.vendors);

  const filteredToggles: DiscountToggles = {};
  for (const [vendor, toggles] of Object.entries(discountToggles)) {
    if (!vendors.has(vendor)) continue;
    const kept = Object.fromEntries(Object.entries(toggles).filter(([id]) => rowIds.has(id)));
    if (Object.keys(kept).length) filteredToggles[vendor] = kept;
  }

  const filteredHidden: HiddenRows = {};
  for (const [id, hidden] of Object.entries(hiddenRows)) {
    if (rowIds.has(id)) filteredHidden[id] = hidden;
  }

  return { discountToggles: filteredToggles, hiddenRows: filteredHidden };
}

export function parseJsonOr<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Rebuild an AnalysisResult from the JSON columns on an Analysis row. */
export function analysisResultFromRow(row: {
  comparisonData: string;
  standardizationNotes: string | null;
  vendorNotes: string | null;
  nextSteps: string | null;
  citations: string | null;
}): AnalysisResult {
  return {
    comparisonTable: parseJsonOr<ComparisonTable>(row.comparisonData, {
      vendors: [],
      normalizedHeadcount: 0,
      sections: [],
    }),
    standardizationNotes: parseJsonOr<string[]>(row.standardizationNotes, []),
    vendorNotes: parseJsonOr<Record<string, string[]>>(row.vendorNotes, {}),
    nextSteps: parseJsonOr<string[]>(row.nextSteps, []),
    citations: parseJsonOr(row.citations, []),
  };
}

export function hashComparison(comparisonData: string): string {
  return createHash('sha256').update(comparisonData).digest('hex');
}
