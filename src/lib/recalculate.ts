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
    if (row.isSectionSubtotal) continue;
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

function makeValue(
  amount: number,
  hasTbc: boolean,
  tbcCount: number,
  existing: VendorValue,
  formula?: string
): VendorValue {
  return {
    ...existing,
    amount,
    display: formatCurrency(amount),
    status: 'currency' as const,
    isConfirmed: !hasTbc,
    note: hasTbc ? `${tbcCount} item(s) still unconfirmed` : 'Auto-calculated',
    audit: {
      ...(existing.audit || { sources: [], override: null, formula: null }),
      formula: formula ?? existing.audit?.formula ?? null,
    },
  };
}

/** Label map for section subtotal rows */
const SECTION_SUBTOTAL_LABELS: Record<string, string> = {
  [SOFTWARE_SECTION]: 'Software Subtotal',
  [IMPLEMENTATION_SECTION]: 'Implementation Subtotal',
  [SERVICE_SECTION]: 'Services Subtotal',
};

const SECTION_SUBTOTAL_IDS: Record<string, string> = {
  [SOFTWARE_SECTION]: 'sw_section_subtotal',
  [IMPLEMENTATION_SECTION]: 'impl_section_subtotal',
  [SERVICE_SECTION]: 'svc_section_subtotal',
};

/**
 * Ensure each fee section has a section subtotal row marked with isSectionSubtotal.
 * Existing isSubtotal rows in fee sections are promoted to isSectionSubtotal.
 * If no subtotal row exists, one is inserted at the end.
 */
function ensureSectionSubtotals(
  section: TableSection,
  vendorCount: number,
  hiddenRows: HiddenRows
): void {
  const label = SECTION_SUBTOTAL_LABELS[section.name];
  if (!label) return; // Not a fee section

  // Check for existing subtotal row (isSubtotal or isSectionSubtotal)
  let subtotalRow = section.rows.find(r => r.isSubtotal || r.isSectionSubtotal);

  if (subtotalRow) {
    // Promote to isSectionSubtotal
    subtotalRow.isSectionSubtotal = true;
    subtotalRow.isSubtotal = true;
  } else {
    // Insert a new section subtotal row
    const id = SECTION_SUBTOTAL_IDS[section.name] || `${section.name}_subtotal`;
    const values: VendorValue[] = Array.from({ length: vendorCount }, () => ({
      amount: 0, display: '$0', note: null, citation: null, isConfirmed: true,
    }));
    subtotalRow = {
      id,
      label,
      values,
      isSubtotal: true,
      isSectionSubtotal: true,
    };
    section.rows.push(subtotalRow);
  }

  // Compute subtotal values
  const contributingIds = section.rows
    .filter(r => !r.isSubtotal && !r.isSectionSubtotal && !r.isPepm && !hiddenRows[r.id])
    .map(r => r.id);
  const formula = `SUM(${contributingIds.join(', ')})`;

  for (let vi = 0; vi < vendorCount; vi++) {
    if (subtotalRow.values[vi]?.isManualOverride) continue;
    const r = sumDataRows(section, vi, hiddenRows);
    subtotalRow.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, subtotalRow.values[vi], formula);
  }
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

  // Step 1: Ensure section subtotals exist and are computed for all fee sections
  for (const section of result.sections) {
    if (section.name === TOTALS_SECTION || section.name === DISCOUNT_SECTION) continue;
    ensureSectionSubtotals(section, vendorCount, hiddenRows);
  }

  // Step 1b: Ensure an "Effective PEPM" row exists right after the software subtotal
  if (result.normalizedHeadcount > 0) {
    const swSection = findSection(SOFTWARE_SECTION);
    if (swSection) {
      const subtotalIdx = swSection.rows.findIndex((r) => r.isSubtotal || r.isSectionSubtotal);
      const pepmIdx = swSection.rows.findIndex((r) => r.id === 'effective_pepm');

      // Build PEPM values from software subtotal
      const pepmValues: VendorValue[] = [];
      for (let vi = 0; vi < vendorCount; vi++) {
        // Check if existing PEPM cell has manual override
        const existingPepmVal = pepmIdx >= 0 ? swSection.rows[pepmIdx].values[vi] : null;
        if (existingPepmVal?.isManualOverride) {
          pepmValues.push(existingPepmVal);
          continue;
        }

        const swResult = sumDataRows(swSection, vi, hiddenRows);
        const pepm = swResult.sum / 12 / result.normalizedHeadcount;
        const roundedPepm = Math.round(pepm * 100) / 100;
        const existing = existingPepmVal || {
          amount: null, display: '', note: null, citation: null, isConfirmed: true,
        };
        const formula = `software_subtotal / 12 / ${result.normalizedHeadcount}`;
        pepmValues.push({
          ...existing,
          amount: roundedPepm,
          display: formatCurrency(roundedPepm),
          status: 'currency' as const,
          isConfirmed: !swResult.hasTbc,
          note: swResult.hasTbc ? 'Based on unconfirmed subtotal' : 'Auto-calculated',
          audit: {
            ...(existing.audit || { sources: [], override: null, formula: null }),
            formula,
          },
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

  function getSectionResult(section: TableSection | undefined, vi: number): SumResult {
    if (!section) return ZERO_SUM;
    const subtotalRow = section.rows.find((r) => r.isSubtotal || r.isSectionSubtotal);
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
    const implResult = getSectionResult(implSection, vi);
    const serviceResult = getSectionResult(serviceSection, vi);

    // Use year-filtered discounts for proper Y2/Y3 calculation
    const allDiscounts = sumDiscountsByYear(discountSection, vi, vendorName, discountToggles, 'all');
    const recurringDiscounts = sumDiscountsByYear(discountSection, vi, vendorName, discountToggles, 'recurring');

    const y1BeforeResult = addResults(softwareResult, implResult, serviceResult);
    const y1Result = addResults(y1BeforeResult, allDiscounts);

    // Year 2/3: no implementation fees, recurring discounts only
    // Growth is ADDITIVE: Y2 scales from base, Y3 scales from Y2
    const growthY2 = (result.headcountGrowthY2 || 0) / 100;
    const growthY3 = (result.headcountGrowthY3 || 0) / 100;

    const scaleResult = (r: SumResult, factor: number): SumResult => ({
      sum: Math.round(r.sum * (1 + factor)),
      hasTbc: r.hasTbc,
      tbcCount: r.tbcCount,
    });

    // Y2 = base * (1 + growthY2)
    const y2SoftwareResult = scaleResult(softwareResult, growthY2);
    const y2ServiceResult = scaleResult(serviceResult, growthY2);
    const y2Result = addResults(y2SoftwareResult, y2ServiceResult, recurringDiscounts);

    // Y3 = Y2 * (1 + growthY3) — additive, not independent from base
    const y3SoftwareResult = scaleResult(y2SoftwareResult, growthY3);
    const y3ServiceResult = scaleResult(y2ServiceResult, growthY3);
    const y3Result = addResults(y3SoftwareResult, y3ServiceResult, recurringDiscounts);

    const total3yrResult = addResults(y1Result, y2Result, y3Result);

    const y2Factor = (1 + growthY2).toFixed(2);
    const y3CompoundFactor = ((1 + growthY2) * (1 + growthY3)).toFixed(2);

    const totalsMap: Record<string, { result: SumResult; formula: string }> = {
      year1_before_discounts: { result: y1BeforeResult, formula: 'software_subtotal + impl_subtotal + service_subtotal' },
      year1_discounts: { result: allDiscounts, formula: 'SUM(enabled_discounts)' },
      year1: { result: y1Result, formula: 'year1_before_discounts + year1_discounts' },
      year2: { result: y2Result, formula: `(software + service)×${y2Factor} + recurring_discounts` },
      year3: { result: y3Result, formula: `(software + service)×${y3CompoundFactor} + recurring_discounts` },
      total3yr: { result: total3yrResult, formula: 'year1 + year2 + year3' },
    };

    for (const row of totalsSection.rows) {
      if (row.values[vi]?.isManualOverride) continue;
      if (row.id in totalsMap) {
        const { result: r, formula } = totalsMap[row.id];
        row.values[vi] = makeValue(r.sum, r.hasTbc, r.tbcCount, row.values[vi], formula);
      }
    }
  }

  return result;
}
