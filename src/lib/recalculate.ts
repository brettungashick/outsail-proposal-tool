import { ComparisonTable, DiscountToggles, HiddenRows, TableSection, VendorValue } from '@/types';
import { formatCurrency } from '@/lib/utils';

const SOFTWARE_SECTION = 'Software Fees (Recurring)';
const IMPLEMENTATION_SECTION = 'Implementation Fees (One-Time)';
const SERVICE_SECTION = 'Service Fees (Recurring)';
const DISCOUNT_SECTION = 'Discounts';
const TOTALS_SECTION = 'Totals';

interface SumResult {
  sum: number;
  hasTbc: boolean;
  tbcCount: number;
}

const ZERO_SUM: SumResult = { sum: 0, hasTbc: false, tbcCount: 0 };

/** Check if a VendorValue represents a zero-contribution cell (not a "To be confirmed"). */
function isZeroContribution(val: VendorValue): boolean {
  if (val.status) {
    return ['not_included', 'na', 'included', 'included_in_bundle', 'hidden'].includes(val.status);
  }
  const d = val.display.toLowerCase().trim();
  return (
    d === 'not included' ||
    d === 'n/a' ||
    d === 'included' ||
    d === 'included in bundle' ||
    d === 'hidden' ||
    d === '$0' ||
    d === '-'
  );
}

/**
 * Sum the amounts of non-subtotal, non-hidden data rows in a section for a given vendor index.
 * Always returns a numeric sum. Tracks how many rows are unconfirmed (TBC).
 */
function sumDataRows(
  section: TableSection | undefined,
  vendorIndex: number,
  hiddenRows: HiddenRows
): SumResult {
  if (!section) return ZERO_SUM;
  let sum = 0;
  let tbcCount = 0;

  for (const row of section.rows) {
    if (row.isSubtotal) continue;
    if ((row as { isPepm?: boolean }).isPepm) continue;
    if (hiddenRows[row.id]) continue;
    const val = row.values[vendorIndex];
    if (!val) continue;

    if (val.amount !== null) {
      sum += val.amount;
    } else if (!isZeroContribution(val)) {
      tbcCount++;
    }
  }

  return { sum, hasTbc: tbcCount > 0, tbcCount };
}

/**
 * Sum enabled discount amounts for a vendor.
 * Discount amounts are negative (e.g., -1200 for a $1,200 discount).
 * Skips discounts that are toggled off in discountToggles.
 */
function sumDiscounts(
  discountSection: TableSection | undefined,
  vendorIndex: number,
  vendorName: string,
  discountToggles: DiscountToggles
): SumResult {
  if (!discountSection) return ZERO_SUM;
  let sum = 0;
  let tbcCount = 0;

  for (const row of discountSection.rows) {
    if (!row.isDiscount) continue;
    if (discountToggles[vendorName]?.[row.id] === false) continue;

    const val = row.values[vendorIndex];
    if (!val) continue;

    const d = val.display.toLowerCase().trim();
    if (d === 'n/a' || d === '-' || d === 'not included') continue;

    if (val.amount !== null) {
      sum += val.amount;
    } else {
      tbcCount++;
    }
  }

  return { sum, hasTbc: tbcCount > 0, tbcCount };
}

/** Combine multiple SumResults by adding sums and tbcCounts. */
function addResults(...results: SumResult[]): SumResult {
  let sum = 0;
  let tbcCount = 0;
  for (const r of results) {
    sum += r.sum;
    tbcCount += r.tbcCount;
  }
  return { sum, hasTbc: tbcCount > 0, tbcCount };
}

function makeValue(amount: number, hasTbc: boolean, tbcCount: number, existing: VendorValue, formula?: string): VendorValue {
  return {
    ...existing,
    amount,
    display: formatCurrency(amount),
    isConfirmed: !hasTbc,
    note: hasTbc ? `${tbcCount} item(s) still unconfirmed` : existing.note,
    audit: {
      ...(existing.audit || { sources: [], override: null, formula: null }),
      formula: formula ?? existing.audit?.formula ?? null,
    },
  };
}

/**
 * Recalculate all subtotals and totals in the comparison table based on
 * the current data row amounts and discount toggle states.
 *
 * Returns a new ComparisonTable (does not mutate the input).
 */
export function recalculateTable(
  data: ComparisonTable,
  discountToggles: DiscountToggles,
  hiddenRows: HiddenRows = {}
): ComparisonTable {
  const result: ComparisonTable = structuredClone(data);
  const vendorCount = result.vendors.length;

  const findSection = (name: string) =>
    result.sections.find((s) => s.name === name);

  // Step 1: Recompute subtotal rows within fee sections
  for (const section of result.sections) {
    if (section.name === TOTALS_SECTION || section.name === DISCOUNT_SECTION) continue;

    for (const row of section.rows) {
      if (!row.isSubtotal) continue;
      // Build formula from contributing row IDs
      const contributingIds = section.rows
        .filter(r => !r.isSubtotal && !(r as { isPepm?: boolean }).isPepm && !hiddenRows[r.id])
        .map(r => r.id);
      const formula = `SUM(${contributingIds.join(', ')})`;
      for (let vi = 0; vi < vendorCount; vi++) {
        const r = sumDataRows(section, vi, hiddenRows);
        row.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, row.values[vi], formula);
      }
    }
  }

  // Step 1b: Ensure an "Effective PEPM" row exists right after the software subtotal
  if (result.normalizedHeadcount > 0) {
    const swSection = result.sections.find((s) => s.name === SOFTWARE_SECTION);
    if (swSection) {
      const subtotalIdx = swSection.rows.findIndex((r) => r.isSubtotal);
      const pepmIdx = swSection.rows.findIndex((r) => r.id === 'effective_pepm');

      // Build PEPM values from software subtotal
      const pepmValues: VendorValue[] = [];
      for (let vi = 0; vi < vendorCount; vi++) {
        const swResult = sumDataRows(swSection, vi, hiddenRows);
        const pepm = swResult.sum / 12 / result.normalizedHeadcount;
        const existing = pepmIdx >= 0 ? swSection.rows[pepmIdx].values[vi] : {
          amount: null, display: '', note: null, citation: null, isConfirmed: true,
        };
        pepmValues.push({
          ...existing,
          amount: Math.round(pepm * 100) / 100,
          display: formatCurrency(Math.round(pepm * 100) / 100),
          isConfirmed: !swResult.hasTbc,
          note: swResult.hasTbc ? 'Based on unconfirmed subtotal' : null,
        });
      }

      if (pepmIdx >= 0) {
        swSection.rows[pepmIdx].values = pepmValues;
      } else {
        const pepmRow = {
          id: 'effective_pepm',
          label: 'Effective PEPM',
          values: pepmValues,
          isSubtotal: false,
          isPepm: true,
        };
        const insertAt = subtotalIdx >= 0 ? subtotalIdx + 1 : swSection.rows.length;
        swSection.rows.splice(insertAt, 0, pepmRow);
      }
    }
  }

  // Step 2: Recompute the Totals section
  const softwareSection = findSection(SOFTWARE_SECTION);
  const implSection = findSection(IMPLEMENTATION_SECTION);
  const serviceSection = findSection(SERVICE_SECTION);
  const discountSection = findSection(DISCOUNT_SECTION);
  const totalsSection = findSection(TOTALS_SECTION);

  if (!totalsSection) return result;

  // Helper: get the SumResult for a fee section (use the subtotal row if exists, otherwise sum data rows)
  function getSectionResult(section: TableSection | undefined, vi: number): SumResult {
    if (!section) return ZERO_SUM;
    const subtotalRow = section.rows.find((r) => r.isSubtotal);
    if (subtotalRow) {
      const val = subtotalRow.values[vi];
      return {
        sum: val?.amount ?? 0,
        hasTbc: val ? !val.isConfirmed : false,
        tbcCount: val && !val.isConfirmed ? 1 : 0,
      };
    }
    return sumDataRows(section, vi, hiddenRows);
  }

  for (let vi = 0; vi < vendorCount; vi++) {
    const vendorName = result.vendors[vi];
    const softwareResult = getSectionResult(softwareSection, vi);
    const implResult = sumDataRows(implSection, vi, hiddenRows);
    const serviceResult = sumDataRows(serviceSection, vi, hiddenRows);
    const discountResult = sumDiscounts(discountSection, vi, vendorName, discountToggles);

    const y1BeforeResult = addResults(softwareResult, implResult, serviceResult);
    const y1Result = addResults(y1BeforeResult, discountResult);

    // Year 2 = (Software + Service) * (1 + growthY2%) + recurring discounts
    const growthY2 = (result.headcountGrowthY2 || 0) / 100;
    const growthY3 = (result.headcountGrowthY3 || 0) / 100;

    const scaleResult = (r: SumResult, factor: number): SumResult => ({
      sum: Math.round(r.sum * (1 + factor)),
      hasTbc: r.hasTbc,
      tbcCount: r.tbcCount,
    });

    const y2SoftwareResult = scaleResult(softwareResult, growthY2);
    const y2ServiceResult = scaleResult(serviceResult, growthY2);
    const y2Result = addResults(y2SoftwareResult, y2ServiceResult, discountResult);

    // Year 3 = (Software + Service) * (1 + growthY3%) + recurring discounts
    const y3SoftwareResult = scaleResult(softwareResult, growthY3);
    const y3ServiceResult = scaleResult(serviceResult, growthY3);
    const y3Result = addResults(y3SoftwareResult, y3ServiceResult, discountResult);

    const total3yrResult = addResults(y1Result, y2Result, y3Result);

    const totalsMap: Record<string, { result: SumResult; formula: string }> = {
      year1_before_discounts: { result: y1BeforeResult, formula: 'software_subtotal + impl_total + service_total' },
      year1_discounts: { result: discountResult, formula: 'SUM(enabled_discounts)' },
      year1: { result: y1Result, formula: 'year1_before_discounts + year1_discounts' },
      year2: { result: y2Result, formula: `(software + service)×${(1 + growthY2).toFixed(2)} + discounts` },
      year3: { result: y3Result, formula: `(software + service)×${(1 + growthY3).toFixed(2)} + discounts` },
      total3yr: { result: total3yrResult, formula: 'year1 + year2 + year3' },
    };

    for (const row of totalsSection.rows) {
      if (row.id in totalsMap) {
        const { result: r, formula } = totalsMap[row.id];
        row.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, row.values[vi], formula);
      }
    }
  }

  return result;
}
