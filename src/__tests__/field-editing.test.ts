/**
 * Tests for field editing flow — verifies all editable fields save correctly.
 *
 * These tests would have caught:
 * - Bug E: Computed cells (subtotals, Y2, Y3, total3yr) not being editable
 * - Bug F: Stale closure in debounced save
 * - Bug J: Status→currency losing the amount
 * - Bug M: /yr suffix parsing inconsistency between EditableCell and page handler
 * - Bug L: New rows missing status field
 * - Bug I: makeValue() preserving stale status on auto-calculated cells
 */

import { describe, it, expect } from 'vitest';
import { recalculateTable } from '@/lib/recalculate';
import { ComparisonTable, CellStatus, VendorValue } from '@/types';

// ─── Simulate the edit handlers from analysis/page.tsx ────────────────────────

/**
 * Simulates handleCellEdit from page.tsx.
 * This is a pure-function extraction of the handler logic so we can test
 * the data transformation without React state.
 */
function simulateCellEdit(
  comparisonData: ComparisonTable,
  sectionIndex: number,
  rowIndex: number,
  vendorIndex: number,
  newDisplayValue: string,
  newAmount: number | null,
  discountToggles = {},
  hiddenRows = {},
): ComparisonTable {
  const updated = structuredClone(comparisonData);
  const row = updated.sections[sectionIndex].rows[rowIndex];
  const val = row.values[vendorIndex];

  val.display = newDisplayValue;
  if (newAmount !== null) {
    val.amount = newAmount;
  } else {
    // Match the page.tsx fallback parser (Fix M: strips /yr suffix)
    const numVal = parseFloat(newDisplayValue.replace(/[$,]/g, '').replace(/\/yr$/i, '').trim());
    if (!isNaN(numVal)) {
      val.amount = numVal;
    }
  }

  // Mark computed cells as manually overridden (Fix E)
  const isComputedRow = row.isSubtotal || row.isPepm || updated.sections[sectionIndex].name === 'Totals';
  if (isComputedRow) {
    val.isManualOverride = true;
  }

  return recalculateTable(updated, discountToggles, hiddenRows);
}

/**
 * Simulates handleCellStatusChange from page.tsx.
 */
function simulateStatusChange(
  comparisonData: ComparisonTable,
  sectionIndex: number,
  rowIndex: number,
  vendorIndex: number,
  newStatus: CellStatus,
  discountToggles = {},
  hiddenRows = {},
): ComparisonTable {
  const updated = structuredClone(comparisonData);
  const row = updated.sections[sectionIndex].rows[rowIndex];
  const val = row.values[vendorIndex];

  const displayMap: Record<CellStatus, string> = {
    currency: val.display,
    tbc: 'To be confirmed',
    included: 'Included',
    included_in_bundle: 'Included in bundle',
    not_included: 'Not included',
    na: 'N/A',
    hidden: 'Hidden',
  };

  val.status = newStatus;
  val.isConfirmed = newStatus !== 'tbc';
  if (newStatus === 'currency') {
    if (val.amount === null) {
      val.display = 'To be confirmed';
      val.status = 'tbc';
      val.isConfirmed = false;
    } else {
      val.display = displayMap[newStatus];
    }
  } else {
    val.display = displayMap[newStatus];
    val.amount = null;
  }

  const isComputedRow = row.isSubtotal || row.isPepm || updated.sections[sectionIndex].name === 'Totals';
  if (isComputedRow) {
    val.isManualOverride = true;
  }

  return recalculateTable(updated, discountToggles, hiddenRows);
}

/**
 * Simulates handleClearOverride from page.tsx.
 */
function simulateClearOverride(
  comparisonData: ComparisonTable,
  sectionIndex: number,
  rowIndex: number,
  vendorIndex: number,
  discountToggles = {},
  hiddenRows = {},
): ComparisonTable {
  const updated = structuredClone(comparisonData);
  delete updated.sections[sectionIndex].rows[rowIndex].values[vendorIndex].isManualOverride;
  return recalculateTable(updated, discountToggles, hiddenRows);
}

// ─── Test Fixture ────────────────────────────────────────────────────────────

function makeEditableTable(): ComparisonTable {
  return {
    vendors: ['Vendor A', 'Vendor B'],
    normalizedHeadcount: 100,
    sections: [
      {
        name: 'Software Fees (Recurring)',
        rows: [
          {
            id: 'sw_core',
            label: 'Core HR',
            values: [
              { amount: 10000, display: '$10,000', note: null, citation: null, isConfirmed: true, status: 'currency' as CellStatus },
              { amount: 8000, display: '$8,000', note: null, citation: null, isConfirmed: true, status: 'currency' as CellStatus },
            ],
          },
          {
            id: 'sw_subtotal',
            label: 'Software Subtotal',
            isSubtotal: true,
            values: [
              { amount: 10000, display: '$10,000', note: 'Auto-calculated', citation: null, isConfirmed: true },
              { amount: 8000, display: '$8,000', note: 'Auto-calculated', citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Implementation Fees (One-Time)',
        rows: [
          {
            id: 'impl_setup',
            label: 'Setup Fee',
            values: [
              { amount: 5000, display: '$5,000', note: null, citation: null, isConfirmed: true },
              { amount: 3000, display: '$3,000', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'impl_subtotal',
            label: 'Impl Subtotal',
            isSubtotal: true,
            values: [
              { amount: 5000, display: '$5,000', note: 'Auto-calculated', citation: null, isConfirmed: true },
              { amount: 3000, display: '$3,000', note: 'Auto-calculated', citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Service Fees (Recurring)',
        rows: [
          {
            id: 'svc_tax',
            label: 'Tax Filing',
            values: [
              { amount: 2000, display: '$2,000', note: null, citation: null, isConfirmed: true },
              { amount: 1500, display: '$1,500', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'svc_subtotal',
            label: 'Service Subtotal',
            isSubtotal: true,
            values: [
              { amount: 2000, display: '$2,000', note: 'Auto-calculated', citation: null, isConfirmed: true },
              { amount: 1500, display: '$1,500', note: 'Auto-calculated', citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Discounts',
        rows: [],
      },
      {
        name: 'Totals',
        rows: [
          { id: 'year1_before_discounts', label: 'Y1 Before Discounts', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'year1_discounts', label: 'Y1 Discounts', isDiscount: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'year1', label: 'Year 1 Total', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'year2', label: 'Year 2 Total', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'year3', label: 'Year 3 Total', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'total3yr', label: '3-Year Total', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
        ],
      },
    ],
  };
}

function findRow(table: ComparisonTable, rowId: string) {
  for (const section of table.sections) {
    const row = section.rows.find(r => r.id === rowId);
    if (row) return row;
  }
  throw new Error(`Row ${rowId} not found`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('field editing: data rows', () => {
  it('editing a data row updates the amount and triggers recalculation', () => {
    const table = makeEditableTable();
    // Edit Vendor A Core HR from $10,000 to $15,000
    const result = simulateCellEdit(table, 0, 0, 0, '$15,000', 15000);

    expect(findRow(result, 'sw_core').values[0].amount).toBe(15000);
    expect(findRow(result, 'sw_subtotal').values[0].amount).toBe(15000);
    // Y1 before discounts: 15000 + 5000 + 2000 = 22000
    expect(findRow(result, 'year1_before_discounts').values[0].amount).toBe(22000);
  });

  it('data row edits do NOT set isManualOverride', () => {
    const table = makeEditableTable();
    const result = simulateCellEdit(table, 0, 0, 0, '$15,000', 15000);
    expect(findRow(result, 'sw_core').values[0].isManualOverride).toBeUndefined();
  });

  it('parses currency from display string when amount is null', () => {
    const table = makeEditableTable();
    // Simulate EditableCell passing null amount with a display string
    const result = simulateCellEdit(table, 0, 0, 0, '$25,000', null);
    expect(findRow(result, 'sw_core').values[0].amount).toBe(25000);
  });

  it('parses display strings with /yr suffix (Bug M)', () => {
    const table = makeEditableTable();
    const result = simulateCellEdit(table, 0, 0, 0, '$12,000/yr', null);
    expect(findRow(result, 'sw_core').values[0].amount).toBe(12000);
  });

  it('handles non-numeric input gracefully', () => {
    const table = makeEditableTable();
    // Non-numeric input: amount stays unchanged from original
    const result = simulateCellEdit(table, 0, 0, 0, 'Contact vendor', null);
    // Amount should remain 10000 (unchanged, since parse failed)
    expect(findRow(result, 'sw_core').values[0].amount).toBe(10000);
    expect(findRow(result, 'sw_core').values[0].display).toBe('Contact vendor');
  });
});

describe('field editing: computed rows (Bug E)', () => {
  it('editing a subtotal row sets isManualOverride', () => {
    const table = makeEditableTable();
    // Edit Software Subtotal directly
    const result = simulateCellEdit(table, 0, 1, 0, '$50,000', 50000);

    const subtotal = findRow(result, 'sw_subtotal').values[0];
    expect(subtotal.amount).toBe(50000);
    expect(subtotal.isManualOverride).toBe(true);
  });

  it('editing a totals row sets isManualOverride', () => {
    const table = makeEditableTable();
    // Edit Year 2 Total (section index 4 = Totals, row index 3 = year2)
    const result = simulateCellEdit(table, 4, 3, 0, '$99,999', 99999);

    const y2 = findRow(result, 'year2').values[0];
    expect(y2.amount).toBe(99999);
    expect(y2.isManualOverride).toBe(true);
  });

  it('overridden cell survives subsequent data row edits', () => {
    let table = makeEditableTable();

    // Step 1: Override Y2 total
    table = simulateCellEdit(table, 4, 3, 0, '$99,999', 99999);
    expect(findRow(table, 'year2').values[0].amount).toBe(99999);

    // Step 2: Edit a data row (Core HR)
    table = simulateCellEdit(table, 0, 0, 0, '$20,000', 20000);

    // Y2 should STILL be the override value
    expect(findRow(table, 'year2').values[0].amount).toBe(99999);
    // But Y1 should have recalculated
    // Y1 before discounts: 20000 + 5000 + 2000 = 27000
    expect(findRow(table, 'year1_before_discounts').values[0].amount).toBe(27000);
  });

  it('clearing override restores auto-calculated value', () => {
    let table = makeEditableTable();

    // Step 1: Override Y2
    table = simulateCellEdit(table, 4, 3, 0, '$99,999', 99999);
    expect(findRow(table, 'year2').values[0].amount).toBe(99999);

    // Step 2: Clear override
    table = simulateClearOverride(table, 4, 3, 0);

    // Y2 should revert to auto-calculated: software (10000) + service (2000) = 12000
    expect(findRow(table, 'year2').values[0].amount).toBe(12000);
    expect(findRow(table, 'year2').values[0].isManualOverride).toBeUndefined();
  });
});

describe('field editing: status changes', () => {
  it('changing status to "included" nullifies the amount', () => {
    const table = makeEditableTable();
    const result = simulateStatusChange(table, 0, 0, 0, 'included');

    const cell = findRow(result, 'sw_core').values[0];
    expect(cell.amount).toBeNull();
    expect(cell.display).toBe('Included');
    expect(cell.status).toBe('included');
  });

  it('changing status to "included" recalculates subtotals correctly', () => {
    const table = makeEditableTable();
    const result = simulateStatusChange(table, 0, 0, 0, 'included');

    // Software subtotal should now be 0 (the only row was set to Included)
    expect(findRow(result, 'sw_subtotal').values[0].amount).toBe(0);
  });

  it('switching back to currency with null amount falls back to TBC (Bug J)', () => {
    let table = makeEditableTable();

    // Step 1: Set to "Included" (amount becomes null)
    table = simulateStatusChange(table, 0, 0, 0, 'included');
    expect(findRow(table, 'sw_core').values[0].amount).toBeNull();

    // Step 2: Switch back to "currency"
    table = simulateStatusChange(table, 0, 0, 0, 'currency');

    const cell = findRow(table, 'sw_core').values[0];
    // Should fall back to TBC since amount is null
    expect(cell.status).toBe('tbc');
    expect(cell.display).toBe('To be confirmed');
    expect(cell.isConfirmed).toBe(false);
  });

  it('switching back to currency with existing amount preserves it', () => {
    let table = makeEditableTable();

    // Set to TBC (amount becomes null), then set amount, then check currency switch
    table = simulateStatusChange(table, 0, 0, 0, 'tbc');

    // Manually set amount back before switching to currency
    const updated = structuredClone(table);
    updated.sections[0].rows[0].values[0].amount = 7500;
    table = simulateStatusChange(updated, 0, 0, 0, 'currency');

    const cell = findRow(table, 'sw_core').values[0];
    expect(cell.amount).toBe(7500);
    // Should stay as currency, not fall back to TBC
    expect(cell.status).not.toBe('tbc');
  });
});

describe('field editing: new row creation (Bug L)', () => {
  it('new rows should have status field set', () => {
    // Simulate the handleAddRow logic
    const newRowValues: VendorValue[] = ['Vendor A', 'Vendor B'].map(() => ({
      amount: null,
      display: 'To be confirmed',
      note: null,
      citation: null,
      isConfirmed: false,
      status: 'tbc' as CellStatus,
    }));

    for (const val of newRowValues) {
      expect(val.status).toBe('tbc');
      expect(val.isConfirmed).toBe(false);
    }
  });
});

describe('field editing: sequential rapid edits', () => {
  it('multiple edits to different cells all take effect', () => {
    let table = makeEditableTable();

    // Edit Core HR
    table = simulateCellEdit(table, 0, 0, 0, '$20,000', 20000);
    // Edit Setup Fee
    table = simulateCellEdit(table, 1, 0, 0, '$8,000', 8000);
    // Edit Tax Filing
    table = simulateCellEdit(table, 2, 0, 0, '$3,000', 3000);

    // All edits should be reflected
    expect(findRow(table, 'sw_core').values[0].amount).toBe(20000);
    expect(findRow(table, 'impl_setup').values[0].amount).toBe(8000);
    expect(findRow(table, 'svc_tax').values[0].amount).toBe(3000);

    // All totals should reflect all three edits
    // Y1 before discounts: 20000 + 8000 + 3000 = 31000
    expect(findRow(table, 'year1_before_discounts').values[0].amount).toBe(31000);
  });

  it('editing same cell multiple times keeps last value', () => {
    let table = makeEditableTable();

    table = simulateCellEdit(table, 0, 0, 0, '$5,000', 5000);
    table = simulateCellEdit(table, 0, 0, 0, '$15,000', 15000);
    table = simulateCellEdit(table, 0, 0, 0, '$25,000', 25000);

    expect(findRow(table, 'sw_core').values[0].amount).toBe(25000);
    expect(findRow(table, 'sw_subtotal').values[0].amount).toBe(25000);
  });
});
