import { ComparisonTable, DiscountToggles, VendorValue, TableSection } from '@/types';
import { formatCurrency } from './utils';

/**
 * Recalculates subtotals and totals in-place after a user edits a line item.
 * Returns a new ComparisonTable with updated values.
 */
export function recalculateTotals(
  table: ComparisonTable,
  discountToggles: DiscountToggles
): ComparisonTable {
  const vendors = table.vendors;
  const sections = table.sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) => ({ ...r, values: r.values.map((v) => ({ ...v })) })),
  }));

  const findSection = (name: string): TableSection | undefined =>
    sections.find((s) => s.name === name);

  const softwareSection = findSection('Software Fees (Recurring)');
  const implSection = findSection('Implementation Fees (One-Time)');
  const serviceSection = findSection('Service Fees (Recurring)');
  const discountSection = findSection('Discounts');
  const totalsSection = findSection('Totals');

  // Sum non-subtotal rows in a section for a given vendor index
  function sumSection(section: TableSection | undefined, vendorIdx: number): number | null {
    if (!section) return 0;
    let total = 0;
    let hasNull = false;
    for (const row of section.rows) {
      if (row.isSubtotal) continue;
      const val = row.values[vendorIdx];
      if (!val) continue;
      if (val.amount === null) {
        // "Not included" or "N/A" rows should be treated as 0, not null
        const display = val.display?.toLowerCase() || '';
        if (display === 'not included' || display === 'n/a' || display === 'included in bundle') {
          continue;
        }
        hasNull = true;
      } else {
        total += val.amount;
      }
    }
    return hasNull ? null : total;
  }

  // Update a subtotal row within a section
  function updateSectionSubtotal(section: TableSection | undefined, vendorIdx: number) {
    if (!section) return;
    for (const row of section.rows) {
      if (!row.isSubtotal) continue;
      const val = row.values[vendorIdx];
      if (!val || val.isManualOverride) continue;
      const sum = sumSection(section, vendorIdx);
      updateValue(val, sum);
    }
  }

  // Sum enabled discount rows for a vendor, optionally filtering by year
  function sumDiscounts(
    vendorIdx: number,
    yearFilter: 'year1_only' | 'recurring' | 'all'
  ): number | null {
    if (!discountSection) return 0;
    let total = 0;
    let hasNull = false;
    const vendorName = vendors[vendorIdx];

    for (const row of discountSection.rows) {
      if (!row.isDiscount) continue;
      // Check if toggled off
      if (discountToggles[vendorName]?.[row.id] === false) continue;

      const val = row.values[vendorIdx];
      if (!val) continue;
      const display = val.display?.toLowerCase() || '';
      if (display === 'n/a' || display === 'not included') continue;

      // Determine if this is a year-1-only discount based on label/note
      const label = row.label.toLowerCase();
      const note = (val.note || '').toLowerCase();
      const isYear1Only =
        label.includes('first year') ||
        label.includes('year 1') ||
        label.includes('first-year') ||
        note.includes('first year') ||
        note.includes('year 1') ||
        note.includes('first-year');

      if (yearFilter === 'year1_only' && !isYear1Only) continue;
      if (yearFilter === 'recurring' && isYear1Only) continue;

      if (val.amount === null) {
        hasNull = true;
      } else {
        total += val.amount; // Discount amounts are already negative
      }
    }
    return hasNull ? null : total;
  }

  function updateValue(val: VendorValue, amount: number | null) {
    val.amount = amount;
    val.display = formatCurrency(amount);
    val.isConfirmed = amount !== null;
    if (amount !== null) {
      val.note = 'Auto-calculated';
    }
  }

  // Safe add: if any operand is null, result is null
  function safeAdd(...values: (number | null)[]): number | null {
    let total = 0;
    for (const v of values) {
      if (v === null) return null;
      total += v;
    }
    return total;
  }

  // Recalculate per vendor
  for (let vi = 0; vi < vendors.length; vi++) {
    // 1. Recalculate section subtotals
    updateSectionSubtotal(softwareSection, vi);
    updateSectionSubtotal(implSection, vi);
    updateSectionSubtotal(serviceSection, vi);

    // 2. Get subtotal values for totals computation
    const softwareSubtotal = getSubtotalAmount(softwareSection, vi);
    const implSubtotal = getSubtotalAmount(implSection, vi);
    const serviceSubtotal = getSubtotalAmount(serviceSection, vi);

    // 3. Get discount sums
    const allDiscounts = sumDiscounts(vi, 'all');
    const recurringDiscounts = sumDiscounts(vi, 'recurring');

    // 4. Compute totals
    if (!totalsSection) continue;

    for (const row of totalsSection.rows) {
      const val = row.values[vi];
      if (!val || val.isManualOverride) continue;

      switch (row.id) {
        case 'year1_before_discounts':
          updateValue(val, safeAdd(softwareSubtotal, implSubtotal, serviceSubtotal));
          break;
        case 'year1_discounts':
          updateValue(val, allDiscounts);
          break;
        case 'year1': {
          const before = safeAdd(softwareSubtotal, implSubtotal, serviceSubtotal);
          updateValue(val, safeAdd(before, allDiscounts));
          break;
        }
        case 'year2': {
          const y2 = safeAdd(softwareSubtotal, serviceSubtotal, recurringDiscounts);
          updateValue(val, y2);
          break;
        }
        case 'year3': {
          const y3 = safeAdd(softwareSubtotal, serviceSubtotal, recurringDiscounts);
          updateValue(val, y3);
          break;
        }
        case 'total3yr': {
          const before = safeAdd(softwareSubtotal, implSubtotal, serviceSubtotal);
          const y1 = safeAdd(before, allDiscounts);
          const y2 = safeAdd(softwareSubtotal, serviceSubtotal, recurringDiscounts);
          const y3 = y2;
          updateValue(val, safeAdd(y1, y2, y3));
          break;
        }
      }
    }
  }

  return { ...table, sections };
}

/** Get the subtotal row amount from a section, falling back to summing rows */
function getSubtotalAmount(section: TableSection | undefined, vendorIdx: number): number | null {
  if (!section) return 0;
  const subtotalRow = section.rows.find((r) => r.isSubtotal);
  if (subtotalRow) {
    return subtotalRow.values[vendorIdx]?.amount ?? null;
  }
  // No subtotal row — sum all rows
  let total = 0;
  let hasNull = false;
  for (const row of section.rows) {
    const val = row.values[vendorIdx];
    if (!val) continue;
    const display = val.display?.toLowerCase() || '';
    if (display === 'not included' || display === 'n/a' || display === 'included in bundle') continue;
    if (val.amount === null) {
      hasNull = true;
    } else {
      total += val.amount;
    }
  }
  return hasNull ? null : total;
}
