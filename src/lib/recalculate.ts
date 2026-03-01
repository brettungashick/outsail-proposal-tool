import { ComparisonTable, DiscountToggles, HiddenRows, TableSection, VendorValue } from '@/types';
import { formatCurrency } from '@/lib/utils';

const SOFTWARE_SECTION = 'Software Fees (Recurring)';
const IMPLEMENTATION_SECTION = 'Implementation Fees (One-Time)';
const SERVICE_SECTION = 'Service Fees (Recurring)';
const DISCOUNT_SECTION = 'Discounts';
const TOTALS_SECTION = 'Totals';

/** Check if a display value represents a zero-contribution cell (not a "To be confirmed"). */
function isZeroContribution(display: string): boolean {
  const d = display.toLowerCase().trim();
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
 * Returns null if any contributing row has a null amount (meaning "To be confirmed").
 */
function sumDataRows(
  section: TableSection | undefined,
  vendorIndex: number,
  hiddenRows: HiddenRows
): number | null {
  if (!section) return 0;
  let sum = 0;
  let hasNull = false;

  for (const row of section.rows) {
    if (row.isSubtotal) continue;
    if (hiddenRows[row.id]) continue; // Skip hidden rows
    const val = row.values[vendorIndex];
    if (!val) continue;

    if (val.amount !== null) {
      sum += val.amount;
    } else {
      if (!isZeroContribution(val.display)) {
        hasNull = true;
      }
    }
  }

  return hasNull ? null : sum;
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
): number | null {
  if (!discountSection) return 0;
  let sum = 0;
  let hasNull = false;

  for (const row of discountSection.rows) {
    if (!row.isDiscount) continue;

    // Check if toggled off
    if (discountToggles[vendorName]?.[row.id] === false) continue;

    const val = row.values[vendorIndex];
    if (!val) continue;

    const d = val.display.toLowerCase().trim();
    if (d === 'n/a' || d === '-' || d === 'not included') continue;

    if (val.amount !== null) {
      sum += val.amount;
    } else {
      hasNull = true;
    }
  }

  return hasNull ? null : sum;
}

function makeValue(amount: number | null, existing: VendorValue): VendorValue {
  return {
    ...existing,
    amount,
    display: amount !== null ? formatCurrency(amount) : 'To be confirmed',
    isConfirmed: amount !== null,
  };
}

function safeAdd(...values: (number | null)[]): number | null {
  if (values.some((v) => v === null)) return null;
  return values.reduce((a, b) => (a as number) + (b as number), 0) as number;
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
  const result: ComparisonTable = JSON.parse(JSON.stringify(data));
  const vendorCount = result.vendors.length;

  const findSection = (name: string) =>
    result.sections.find((s) => s.name === name);

  // Step 1: Recompute subtotal rows within fee sections
  for (const section of result.sections) {
    if (section.name === TOTALS_SECTION || section.name === DISCOUNT_SECTION) continue;

    for (const row of section.rows) {
      if (!row.isSubtotal) continue;
      for (let vi = 0; vi < vendorCount; vi++) {
        const total = sumDataRows(section, vi, hiddenRows);
        row.values[vi] = makeValue(total, row.values[vi]);
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

  // Helper: get the subtotal for a fee section (use the subtotal row if exists, otherwise sum data rows)
  function getSectionTotal(section: TableSection | undefined, vi: number): number | null {
    if (!section) return 0;
    const subtotalRow = section.rows.find((r) => r.isSubtotal);
    if (subtotalRow) return subtotalRow.values[vi]?.amount ?? null;
    return sumDataRows(section, vi, hiddenRows);
  }

  for (let vi = 0; vi < vendorCount; vi++) {
    const vendorName = result.vendors[vi];
    const softwareTotal = getSectionTotal(softwareSection, vi);
    const implTotal = sumDataRows(implSection, vi, hiddenRows);
    const serviceTotal = sumDataRows(serviceSection, vi, hiddenRows);
    const discountTotal = sumDiscounts(discountSection, vi, vendorName, discountToggles);

    const y1Before = safeAdd(softwareTotal ?? 0, implTotal ?? 0, serviceTotal ?? 0);
    // If any fee section has nulls, propagate
    const y1BeforeActual =
      softwareTotal === null || implTotal === null || serviceTotal === null
        ? null
        : y1Before;

    const y1 = safeAdd(y1BeforeActual, discountTotal);

    // Year 2 = Software + Service + recurring discounts (no implementation)
    const y2Before = safeAdd(softwareTotal, serviceTotal);
    const y2 = safeAdd(y2Before, discountTotal);

    // Year 3 = same as Year 2
    const y3 = y2;

    const total3yr = safeAdd(y1, y2, y3);

    const totalsMap: Record<string, number | null> = {
      year1_before_discounts: y1BeforeActual,
      year1_discounts: discountTotal,
      year1: y1,
      year2: y2,
      year3: y3,
      total3yr: total3yr,
    };

    for (const row of totalsSection.rows) {
      if (row.id in totalsMap) {
        row.values[vi] = makeValue(totalsMap[row.id], row.values[vi]);
      }
    }
  }

  return result;
}
