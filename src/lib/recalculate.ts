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
    if (row.isPepm) continue;
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

/** Sum enabled discounts filtering by year type. */
function sumDiscountsByYear(
  discountSection: TableSection | undefined,
  vendorIndex: number,
  vendorName: string,
  discountToggles: DiscountToggles,
  yearFilter: 'all' | 'year1_only' | 'recurring'
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

    // Determine if this is a year-1-only discount
    const label = row.label.toLowerCase();
    const note = (val.note || '').toLowerCase();
    const isYear1Only =
      label.includes('first year') ||
      label.includes('year 1') ||
      label.includes('first-year') ||
      label.includes('one-time') ||
      label.includes('one time') ||
      label.includes('signing') ||
      label.includes('implementation discount') ||
      note.includes('first year') ||
      note.includes('year 1') ||
      note.includes('first-year') ||
      note.includes('one-time') ||
      note.includes('one time') ||
      note.includes('year 1 only');

    if (yearFilter === 'year1_only' && !isYear1Only) continue;
    if (yearFilter === 'recurring' && isYear1Only) continue;

    if (val.amount !== null) {
      // Ensure discounts are always negative (guard against AI returning positive values)
      sum += val.amount > 0 ? -val.amount : val.amount;
    } else {
      tbcCount++;
    }
  }

  return { sum, hasTbc: tbcCount > 0, tbcCount };
}

/** Combine multiple SumResults. */
function addResults(...results: SumResult[]): SumResult {
  let sum = 0;
  let tbcCount = 0;
  for (const r of results) {
    sum += r.sum;
    tbcCount += r.tbcCount;
  }
  return { sum, hasTbc: tbcCount > 0, tbcCount };
}

function makeValue(amount: number, hasTbc: boolean, tbcCount: number, existing: VendorValue): VendorValue {
  return {
    ...existing,
    amount,
    display: formatCurrency(amount),
    status: 'currency' as const,
    isConfirmed: !hasTbc,
    note: hasTbc ? `${tbcCount} item(s) still unconfirmed` : 'Auto-calculated',
  };
}

/**
 * Recalculate all subtotals and totals in the comparison table.
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
      for (let vi = 0; vi < vendorCount; vi++) {
        if (row.values[vi]?.isManualOverride) continue;
        const r = sumDataRows(section, vi, hiddenRows);
        row.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, row.values[vi]);
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

    // Use year-filtered discounts for proper Y2/Y3 calculation
    const allDiscounts = sumDiscountsByYear(discountSection, vi, vendorName, discountToggles, 'all');
    const recurringDiscounts = sumDiscountsByYear(discountSection, vi, vendorName, discountToggles, 'recurring');

    const y1BeforeResult = addResults(softwareResult, implResult, serviceResult);
    const y1Result = addResults(y1BeforeResult, allDiscounts);

    // Year 2/3: no implementation fees, recurring discounts only
    const growthY2 = (result.headcountGrowthY2 || 0) / 100;
    const growthY3 = (result.headcountGrowthY3 || 0) / 100;

    const scaleResult = (r: SumResult, factor: number): SumResult => ({
      sum: Math.round(r.sum * (1 + factor)),
      hasTbc: r.hasTbc,
      tbcCount: r.tbcCount,
    });

    const y2SoftwareResult = scaleResult(softwareResult, growthY2);
    const y2ServiceResult = scaleResult(serviceResult, growthY2);
    const y2Result = addResults(y2SoftwareResult, y2ServiceResult, recurringDiscounts);

    const y3SoftwareResult = scaleResult(softwareResult, growthY3);
    const y3ServiceResult = scaleResult(serviceResult, growthY3);
    const y3Result = addResults(y3SoftwareResult, y3ServiceResult, recurringDiscounts);

    const total3yrResult = addResults(y1Result, y2Result, y3Result);

    const totalsMap: Record<string, SumResult> = {
      year1_before_discounts: y1BeforeResult,
      year1_discounts: allDiscounts,
      year1: y1Result,
      year2: y2Result,
      year3: y3Result,
      total3yr: total3yrResult,
    };

    for (const row of totalsSection.rows) {
      if (row.values[vi]?.isManualOverride) continue;
      if (row.id in totalsMap) {
        const r = totalsMap[row.id];
        row.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, row.values[vi]);
      }
    }
  }

  return result;
}
