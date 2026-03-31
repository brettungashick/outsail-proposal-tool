/**
 * Tests for recalculate.ts — verifies proposal numbers match source quotes.
 *
 * These tests would have caught:
 * - Bug A: Discounts applied to all years instead of Year 1 only
 * - Bug N: Positive discount amounts inflating totals instead of reducing them
 * - Bug I: makeValue() preserving stale status field on auto-calculated cells
 * - The row-level override skip bug that blocked all vendors when one was overridden
 */

import { describe, it, expect } from 'vitest';
import { recalculateTable } from '@/lib/recalculate';
import { ComparisonTable, DiscountToggles, HiddenRows } from '@/types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTable(overrides: Partial<ComparisonTable> = {}): ComparisonTable {
  return {
    vendors: ['Vendor A', 'Vendor B'],
    normalizedHeadcount: 500,
    sections: [
      {
        name: 'Software Fees (Recurring)',
        rows: [
          {
            id: 'sw_core_hr',
            label: 'Core HR',
            values: [
              { amount: 60000, display: '$60,000', note: null, citation: null, isConfirmed: true },
              { amount: 48000, display: '$48,000', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'sw_payroll',
            label: 'Payroll',
            values: [
              { amount: 36000, display: '$36,000', note: null, citation: null, isConfirmed: true },
              { amount: 30000, display: '$30,000', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'sw_subtotal',
            label: 'Software Subtotal',
            isSubtotal: true,
            values: [
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Implementation Fees (One-Time)',
        rows: [
          {
            id: 'impl_base',
            label: 'Base Implementation',
            values: [
              { amount: 15000, display: '$15,000', note: null, citation: null, isConfirmed: true },
              { amount: 10000, display: '$10,000', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'impl_subtotal',
            label: 'Implementation Subtotal',
            isSubtotal: true,
            values: [
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
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
              { amount: 5000, display: '$5,000', note: null, citation: null, isConfirmed: true },
              { amount: 4000, display: '$4,000', note: null, citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'svc_subtotal',
            label: 'Service Subtotal',
            isSubtotal: true,
            values: [
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
              { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Discounts',
        rows: [
          {
            id: 'discount_first_year',
            label: 'First Year Discount - 10%',
            isDiscount: true,
            values: [
              { amount: -10000, display: '-$10,000', note: '10% first year discount', citation: null, isConfirmed: true },
              { amount: -5000, display: '-$5,000', note: 'Year 1 only discount', citation: null, isConfirmed: true },
            ],
          },
          {
            id: 'discount_recurring',
            label: 'Volume Discount',
            isDiscount: true,
            values: [
              { amount: -3000, display: '-$3,000', note: 'Recurring volume discount', citation: null, isConfirmed: true },
              { amount: null, display: 'N/A', note: null, citation: null, isConfirmed: true },
            ],
          },
        ],
      },
      {
        name: 'Totals',
        rows: [
          { id: 'year1_before_discounts', label: 'Year 1 (Before Discounts)', isSubtotal: true, values: [
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
            { amount: 0, display: '$0', note: null, citation: null, isConfirmed: true },
          ]},
          { id: 'year1_discounts', label: 'Year 1 Discounts', isDiscount: true, values: [
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
    ...overrides,
  };
}

function getRow(table: ComparisonTable, rowId: string) {
  for (const section of table.sections) {
    const row = section.rows.find(r => r.id === rowId);
    if (row) return row;
  }
  throw new Error(`Row ${rowId} not found`);
}

function getAmount(table: ComparisonTable, rowId: string, vendorIndex: number): number | null {
  return getRow(table, rowId).values[vendorIndex].amount;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('recalculateTable', () => {
  describe('subtotal calculations match source data rows', () => {
    it('computes section subtotals as sum of data rows', () => {
      const result = recalculateTable(makeTable(), {}, {});

      // Vendor A: 60000 + 36000 = 96000
      expect(getAmount(result, 'sw_subtotal', 0)).toBe(96000);
      // Vendor B: 48000 + 30000 = 78000
      expect(getAmount(result, 'sw_subtotal', 1)).toBe(78000);

      // Implementation subtotals
      expect(getAmount(result, 'impl_subtotal', 0)).toBe(15000);
      expect(getAmount(result, 'impl_subtotal', 1)).toBe(10000);

      // Service subtotals
      expect(getAmount(result, 'svc_subtotal', 0)).toBe(5000);
      expect(getAmount(result, 'svc_subtotal', 1)).toBe(4000);
    });

    it('Year 1 before discounts = software + implementation + service', () => {
      const result = recalculateTable(makeTable(), {}, {});

      // Vendor A: 96000 + 15000 + 5000 = 116000
      expect(getAmount(result, 'year1_before_discounts', 0)).toBe(116000);
      // Vendor B: 78000 + 10000 + 4000 = 92000
      expect(getAmount(result, 'year1_before_discounts', 1)).toBe(92000);
    });

    it('Year 1 total = before discounts + all discounts', () => {
      const result = recalculateTable(makeTable(), {}, {});

      // Vendor A: 116000 + (-10000) + (-3000) = 103000
      expect(getAmount(result, 'year1', 0)).toBe(103000);
      // Vendor B: 92000 + (-5000) = 87000
      expect(getAmount(result, 'year1', 1)).toBe(87000);
    });
  });

  describe('discount year-filtering (Bug A: discounts applied to wrong years)', () => {
    it('excludes first-year-only discounts from Year 2 and Year 3', () => {
      const result = recalculateTable(makeTable(), {}, {});

      // Vendor A Year 2: software (96000) + service (5000) + recurring discount (-3000) = 98000
      // NO first-year discount (-10000) and NO implementation (15000)
      expect(getAmount(result, 'year2', 0)).toBe(98000);
      expect(getAmount(result, 'year3', 0)).toBe(98000);

      // Vendor B Year 2: software (78000) + service (4000) = 82000
      // NO first-year discount (-5000) — it was year-1-only
      // Volume discount is N/A for Vendor B
      expect(getAmount(result, 'year2', 1)).toBe(82000);
      expect(getAmount(result, 'year3', 1)).toBe(82000);
    });

    it('3-year total = Y1 + Y2 + Y3', () => {
      const result = recalculateTable(makeTable(), {}, {});

      // Vendor A: 103000 + 98000 + 98000 = 299000
      expect(getAmount(result, 'total3yr', 0)).toBe(299000);
      // Vendor B: 87000 + 82000 + 82000 = 251000
      expect(getAmount(result, 'total3yr', 1)).toBe(251000);
    });

    it('detects year-1-only via multiple keyword patterns', () => {
      const table = makeTable();
      // Test various keyword patterns that should trigger year-1-only detection
      const discountSection = table.sections.find(s => s.name === 'Discounts')!;

      // Change label to use different keyword patterns
      discountSection.rows[0].label = 'One-Time Signing Bonus';
      discountSection.rows[0].values[0].note = null; // Remove note keyword

      const result = recalculateTable(table, {}, {});
      // Should still be excluded from Y2 (matched "one-time" and "signing" in label)
      // Vendor A Y2: 96000 + 5000 + (-3000) = 98000
      expect(getAmount(result, 'year2', 0)).toBe(98000);
    });

    it('treats discounts without year keywords as recurring (applied to all years)', () => {
      const table = makeTable();

      // Volume discount has no year keywords — should apply to Y2/Y3
      const result = recalculateTable(table, {}, {});

      // Y2 should include recurring discount (-3000) but not first-year or implementation
      expect(getAmount(result, 'year2', 0)).toBe(96000 + 5000 - 3000); // 98000
    });
  });

  describe('discount sign handling (Bug N: positive discounts inflating totals)', () => {
    it('forces positive discount amounts to negative', () => {
      const table = makeTable();
      const discountSection = table.sections.find(s => s.name === 'Discounts')!;

      // Simulate AI returning positive discount amount (the bug)
      discountSection.rows[0].values[0].amount = 10000; // WRONG: should be -10000
      discountSection.rows[1].values[0].amount = 3000;  // WRONG: should be -3000

      const result = recalculateTable(table, {}, {});

      // Should still subtract discounts, not add them
      // Vendor A Y1: 116000 + (-10000) + (-3000) = 103000
      expect(getAmount(result, 'year1', 0)).toBe(103000);
      // NOT 116000 + 10000 + 3000 = 129000 (the old bug behavior)
      expect(getAmount(result, 'year1', 0)).not.toBe(129000);
    });
  });

  describe('headcount growth scaling', () => {
    it('applies growth percentage to software and service fees in Y2/Y3', () => {
      const table = makeTable({ headcountGrowthY2: 10, headcountGrowthY3: 20 });
      const result = recalculateTable(table, {}, {});

      // Vendor A Y2: software (96000 * 1.10) + service (5000 * 1.10) + recurring disc (-3000)
      // = 105600 + 5500 - 3000 = 108100
      expect(getAmount(result, 'year2', 0)).toBe(108100);

      // Vendor A Y3: software (96000 * 1.20) + service (5000 * 1.20) + recurring disc (-3000)
      // = 115200 + 6000 - 3000 = 118200
      expect(getAmount(result, 'year3', 0)).toBe(118200);
    });

    it('does not apply growth to implementation fees', () => {
      const table = makeTable({ headcountGrowthY2: 50 });
      const result = recalculateTable(table, {}, {});

      // Implementation should NOT appear in Y2 at all
      const y2 = getAmount(result, 'year2', 0)!;
      // If impl was included with 50% growth: 15000 * 1.5 = 22500 extra
      // Correct Y2 = (96000 + 5000) * 1.5 - 3000 = 148500
      expect(y2).toBe(148500);
      // Wrong (with impl): 148500 + 22500 = 171000
      expect(y2).not.toBe(171000);
    });

    it('handles zero growth gracefully', () => {
      const table = makeTable({ headcountGrowthY2: 0, headcountGrowthY3: 0 });
      const result = recalculateTable(table, {}, {});
      expect(getAmount(result, 'year2', 0)).toBe(98000);
    });

    it('handles undefined growth as zero', () => {
      const table = makeTable();
      delete table.headcountGrowthY2;
      delete table.headcountGrowthY3;
      const result = recalculateTable(table, {}, {});
      expect(getAmount(result, 'year2', 0)).toBe(98000);
    });
  });

  describe('manual override (Bug E: computed fields not editable)', () => {
    it('skips recalculation for cells with isManualOverride', () => {
      const table = makeTable();
      // Manually override Vendor A's Y2 total
      const totalsSection = table.sections.find(s => s.name === 'Totals')!;
      const y2Row = totalsSection.rows.find(r => r.id === 'year2')!;
      y2Row.values[0] = {
        amount: 150000,
        display: '$150,000',
        note: 'Manually set',
        citation: null,
        isConfirmed: true,
        isManualOverride: true,
      };

      const result = recalculateTable(table, {}, {});

      // Vendor A Y2 should stay at manual override value
      expect(getAmount(result, 'year2', 0)).toBe(150000);
      // Vendor B Y2 should still be auto-calculated
      expect(getAmount(result, 'year2', 1)).toBe(82000);
    });

    it('one vendor override does not block other vendor recalculation (row-level bug fix)', () => {
      const table = makeTable();
      // Override Vendor A subtotal only
      const swSection = table.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const subtotalRow = swSection.rows.find(r => r.id === 'sw_subtotal')!;
      subtotalRow.values[0] = {
        amount: 200000,
        display: '$200,000',
        note: 'Manual',
        citation: null,
        isConfirmed: true,
        isManualOverride: true,
      };

      const result = recalculateTable(table, {}, {});

      // Vendor A stays at override
      expect(getAmount(result, 'sw_subtotal', 0)).toBe(200000);
      // Vendor B must still be recalculated (the old bug would skip it)
      expect(getAmount(result, 'sw_subtotal', 1)).toBe(78000);
    });
  });

  describe('auto-calculated cells get status:currency (Bug I)', () => {
    it('sets status to currency on recalculated subtotals', () => {
      const table = makeTable();
      // Set a stale status on subtotal
      const swSection = table.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const subtotalRow = swSection.rows.find(r => r.id === 'sw_subtotal')!;
      subtotalRow.values[0].status = 'included'; // stale status from before

      const result = recalculateTable(table, {}, {});
      const recalcedSubtotal = getRow(result, 'sw_subtotal').values[0];
      expect(recalcedSubtotal.status).toBe('currency');
      expect(recalcedSubtotal.amount).toBe(96000);
    });
  });

  describe('discount toggle interactions', () => {
    it('excludes toggled-off discounts from all calculations', () => {
      const toggles: DiscountToggles = {
        'Vendor A': { 'discount_first_year': false, 'discount_recurring': true },
      };

      const result = recalculateTable(makeTable(), toggles, {});

      // Vendor A Y1: 116000 + (-3000 recurring only) = 113000 (first-year toggled off)
      expect(getAmount(result, 'year1', 0)).toBe(113000);
    });

    it('toggles are vendor-specific', () => {
      const toggles: DiscountToggles = {
        'Vendor A': { 'discount_first_year': false },
        'Vendor B': { 'discount_first_year': true },
      };

      const result = recalculateTable(makeTable(), toggles, {});

      // Vendor A: first-year toggled off, only recurring applies
      expect(getAmount(result, 'year1', 0)).toBe(113000);
      // Vendor B: first-year still on
      expect(getAmount(result, 'year1', 1)).toBe(87000);
    });
  });

  describe('hidden row interactions', () => {
    it('excludes hidden rows from subtotal calculations', () => {
      const hidden: HiddenRows = { 'sw_payroll': true };
      const result = recalculateTable(makeTable(), {}, hidden);

      // Vendor A software subtotal: only Core HR = 60000
      expect(getAmount(result, 'sw_subtotal', 0)).toBe(60000);
      // Vendor B: only Core HR = 48000
      expect(getAmount(result, 'sw_subtotal', 1)).toBe(48000);
    });

    it('hidden rows affect totals transitively', () => {
      const hidden: HiddenRows = { 'sw_payroll': true };
      const result = recalculateTable(makeTable(), {}, hidden);

      // Vendor A Y1 before: 60000 + 15000 + 5000 = 80000
      expect(getAmount(result, 'year1_before_discounts', 0)).toBe(80000);
    });
  });

  describe('PEPM row calculation', () => {
    it('inserts Effective PEPM row after software subtotal', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const swSection = result.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const pepmRow = swSection.rows.find(r => r.id === 'effective_pepm');
      expect(pepmRow).toBeDefined();
      expect(pepmRow!.isPepm).toBe(true);
      expect(pepmRow!.label).toBe('Effective PEPM');
    });

    it('calculates PEPM as software_subtotal / 12 / headcount', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const pepmRow = getRow(result, 'effective_pepm');

      // Vendor A: 96000 / 12 / 500 = 16.00
      expect(pepmRow.values[0].amount).toBe(16);
      // Vendor B: 78000 / 12 / 500 = 13.00
      expect(pepmRow.values[1].amount).toBe(13);
    });

    it('PEPM row placed right after subtotal', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const swSection = result.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const subtotalIdx = swSection.rows.findIndex(r => r.id === 'sw_subtotal');
      const pepmIdx = swSection.rows.findIndex(r => r.id === 'effective_pepm');
      expect(pepmIdx).toBe(subtotalIdx + 1);
    });

    it('PEPM is not inserted when headcount is 0', () => {
      const table = makeTable({ normalizedHeadcount: 0 });
      const result = recalculateTable(table, {}, {});
      const swSection = result.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const pepmRow = swSection.rows.find(r => r.id === 'effective_pepm');
      expect(pepmRow).toBeUndefined();
    });

    it('PEPM excludes hidden rows from calculation', () => {
      const hidden: HiddenRows = { 'sw_payroll': true };
      const result = recalculateTable(makeTable(), {}, hidden);
      const pepmRow = getRow(result, 'effective_pepm');

      // Vendor A: 60000 / 12 / 500 = 10.00
      expect(pepmRow.values[0].amount).toBe(10);
    });

    it('PEPM respects isManualOverride', () => {
      const table = makeTable();
      // Pre-insert a PEPM row with manual override
      const swSection = table.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const subtotalIdx = swSection.rows.findIndex(r => r.isSubtotal);
      swSection.rows.splice(subtotalIdx + 1, 0, {
        id: 'effective_pepm',
        label: 'Effective PEPM',
        isPepm: true,
        values: [
          { amount: 99.99, display: '$99.99', note: 'Manual', citation: null, isConfirmed: true, isManualOverride: true },
          { amount: 50, display: '$50.00', note: null, citation: null, isConfirmed: true },
        ],
      });

      const result = recalculateTable(table, {}, {});
      const pepmRow = getRow(result, 'effective_pepm');

      // Vendor A stays at manual override
      expect(pepmRow.values[0].amount).toBe(99.99);
      // Vendor B is auto-calculated: 78000 / 12 / 500 = 13.00
      expect(pepmRow.values[1].amount).toBe(13);
    });

    it('does not double-insert PEPM on repeated recalculation', () => {
      const table = makeTable();
      const result1 = recalculateTable(table, {}, {});
      const result2 = recalculateTable(result1, {}, {});
      const swSection = result2.sections.find(s => s.name === 'Software Fees (Recurring)')!;
      const pepmRows = swSection.rows.filter(r => r.id === 'effective_pepm');
      expect(pepmRows).toHaveLength(1);
    });

    it('PEPM is excluded from subtotal sum', () => {
      // Run once to insert PEPM, then run again and check subtotal hasn't changed
      const result1 = recalculateTable(makeTable(), {}, {});
      const result2 = recalculateTable(result1, {}, {});

      // Subtotal should still be 96000, not 96000 + 16 (PEPM)
      expect(getAmount(result2, 'sw_subtotal', 0)).toBe(96000);
    });
  });

  describe('audit formula tracking', () => {
    it('adds formula to subtotal cells', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const subtotalVal = getRow(result, 'sw_subtotal').values[0];
      expect(subtotalVal.audit).toBeDefined();
      expect(subtotalVal.audit!.formula).toContain('SUM(');
      expect(subtotalVal.audit!.formula).toContain('sw_core_hr');
    });

    it('adds formula to totals cells', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const y1Val = getRow(result, 'year1').values[0];
      expect(y1Val.audit).toBeDefined();
      expect(y1Val.audit!.formula).toBe('year1_before_discounts + year1_discounts');
    });

    it('includes growth factor in Y2/Y3 formula', () => {
      const table = makeTable({ headcountGrowthY2: 10 });
      const result = recalculateTable(table, {}, {});
      const y2Val = getRow(result, 'year2').values[0];
      expect(y2Val.audit!.formula).toContain('1.10');
    });

    it('PEPM cell has formula', () => {
      const result = recalculateTable(makeTable(), {}, {});
      const pepmVal = getRow(result, 'effective_pepm').values[0];
      expect(pepmVal.audit).toBeDefined();
      expect(pepmVal.audit!.formula).toContain('software_subtotal / 12 / 500');
    });
  });

  describe('TBC (To be confirmed) propagation', () => {
    it('marks subtotal as unconfirmed when any data row is TBC', () => {
      const table = makeTable();
      // Make Vendor A payroll TBC
      table.sections[0].rows[1].values[0] = {
        amount: null,
        display: 'To be confirmed',
        note: null,
        citation: null,
        isConfirmed: false,
      };

      const result = recalculateTable(table, {}, {});
      const subtotal = getRow(result, 'sw_subtotal').values[0];

      // Amount should be sum of confirmed rows only
      expect(subtotal.amount).toBe(60000);
      // But should be marked unconfirmed
      expect(subtotal.isConfirmed).toBe(false);
      expect(subtotal.note).toContain('unconfirmed');
    });
  });
});
