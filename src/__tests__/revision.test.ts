/**
 * Tests for revision.ts — the diff shown before a feedback revision is
 * accepted, and the state carried over from the table it replaces.
 */

import { describe, it, expect } from 'vitest';
import { carryForwardTableState, diffAnalyses, filterStateToRows } from '@/lib/revision';
import { AnalysisResult, ComparisonTable, VendorValue } from '@/types';

function cell(amount: number | null, display?: string, extra: Partial<VendorValue> = {}): VendorValue {
  return {
    amount,
    display: display ?? (amount === null ? 'To be confirmed' : `$${amount.toLocaleString('en-US')}`),
    note: null,
    citation: null,
    isConfirmed: amount !== null,
    ...extra,
  };
}

function makeTable(): ComparisonTable {
  return {
    vendors: ['Vendor A', 'Vendor B'],
    normalizedHeadcount: 500,
    headcountGrowthY2: 5,
    sections: [
      {
        name: 'Software Fees (Recurring)',
        rows: [
          { id: 'sw_core', label: 'Core HR', values: [cell(60000), cell(48000)] },
          { id: 'sw_payroll', label: 'Payroll', values: [cell(36000), cell(30000)] },
        ],
      },
      {
        name: 'Discounts',
        rows: [
          { id: 'discount_a_1', label: 'First Year Discount', isDiscount: true, values: [cell(-5000), cell(null, 'N/A')] },
        ],
      },
    ],
  };
}

function makeResult(table: ComparisonTable = makeTable()): AnalysisResult {
  return {
    comparisonTable: table,
    standardizationNotes: ['Normalized to 500 employees'],
    vendorNotes: { 'Vendor A': ['Quote expires in 30 days'], 'Vendor B': [] },
    nextSteps: ['Confirm Vendor B discount'],
    citations: [],
  };
}

describe('diffAnalyses', () => {
  it('reports no changes for identical analyses', () => {
    const diff = diffAnalyses(makeResult(), makeResult());
    expect(diff.changeCount).toBe(0);
    expect(diff.sections).toEqual([]);
  });

  it('reports a changed cell with vendor and before/after display', () => {
    const after = makeResult();
    after.comparisonTable.sections[0].rows[1].values[1] = cell(null, 'Included in bundle');

    const diff = diffAnalyses(makeResult(), after);
    expect(diff.changeCount).toBe(1);
    expect(diff.sections[0].changed).toEqual([
      {
        rowId: 'sw_payroll',
        label: 'Payroll',
        cells: [{ vendor: 'Vendor B', before: '$30,000', after: 'Included in bundle' }],
      },
    ]);
  });

  it('reports added and removed rows', () => {
    const after = makeResult();
    const sw = after.comparisonTable.sections[0];
    sw.rows = [sw.rows[0], { id: 'sw_benefits', label: 'Benefits Administration', values: [cell(12000), cell(null)] }];

    const diff = diffAnalyses(makeResult(), after);
    expect(diff.sections[0].added.map((r) => r.label)).toEqual(['Benefits Administration']);
    expect(diff.sections[0].removed.map((r) => r.label)).toEqual(['Payroll']);
  });

  it('matches a renamed row by id and reports the rename', () => {
    const after = makeResult();
    after.comparisonTable.sections[0].rows[0].label = 'Core HR (HRIS bundle)';

    const diff = diffAnalyses(makeResult(), after);
    expect(diff.sections[0].changed).toEqual([
      { rowId: 'sw_core', label: 'Core HR (HRIS bundle)', previousLabel: 'Core HR', cells: [] },
    ]);
    expect(diff.sections[0].added).toEqual([]);
  });

  it('matches a re-keyed row by label instead of reporting remove + add', () => {
    const after = makeResult();
    after.comparisonTable.sections[0].rows[1].id = 'payroll_2';

    const diff = diffAnalyses(makeResult(), after);
    expect(diff.changeCount).toBe(0);
  });

  it('compares cells by vendor name, not column position', () => {
    const after = makeResult();
    const table = after.comparisonTable;
    table.vendors = ['Vendor B', 'Vendor A'];
    for (const section of table.sections) {
      for (const row of section.rows) row.values.reverse();
    }

    expect(diffAnalyses(makeResult(), after).changeCount).toBe(0);
  });

  it('reports note changes', () => {
    const after = makeResult();
    after.vendorNotes['Vendor B'] = ['Benefits bundled into Core HR per advisor'];
    after.nextSteps = [];

    const diff = diffAnalyses(makeResult(), after);
    expect(diff.vendorNotes['Vendor B'].added).toEqual(['Benefits bundled into Core HR per advisor']);
    expect(diff.nextSteps.removed).toEqual(['Confirm Vendor B discount']);
    expect(diff.changeCount).toBe(2);
  });

  it('reports a headcount change', () => {
    const after = makeResult();
    after.comparisonTable.normalizedHeadcount = 450;
    expect(diffAnalyses(makeResult(), after).headcount).toEqual({ before: 500, after: 450 });
  });
});

describe('carryForwardTableState', () => {
  it('keeps manual overrides and audit data only on unchanged cells', () => {
    const before = makeTable();
    const audit = { sources: [], override: null, formula: null };
    before.sections[0].rows[0].values[0].isManualOverride = true;
    before.sections[0].rows[0].values[0].audit = audit;
    before.sections[0].rows[1].values[0].isManualOverride = true;

    // The model drops the flags; it changes Payroll for Vendor A but not Core HR.
    const after = makeTable();
    after.sections[0].rows[1].values[0] = cell(40000);
    delete after.headcountGrowthY2;

    const result = carryForwardTableState(before, after);
    expect(result.sections[0].rows[0].values[0].isManualOverride).toBe(true);
    expect(result.sections[0].rows[0].values[0].audit).toEqual(audit);
    expect(result.sections[0].rows[1].values[0].isManualOverride).toBeUndefined();
    expect(result.headcountGrowthY2).toBe(5);
  });

  it('does not mutate its inputs', () => {
    const before = makeTable();
    before.sections[0].rows[0].values[0].isManualOverride = true;
    const after = makeTable();
    carryForwardTableState(before, after);
    expect(after.sections[0].rows[0].values[0].isManualOverride).toBeUndefined();
  });
});

describe('filterStateToRows', () => {
  it('drops toggles and hidden flags for rows and vendors that no longer exist', () => {
    const table = makeTable();
    const { discountToggles, hiddenRows } = filterStateToRows(
      {
        'Vendor A': { discount_a_1: false, discount_gone: true },
        'Vendor C': { discount_a_1: true },
      },
      { sw_payroll: true, sw_removed: true },
      table
    );
    expect(discountToggles).toEqual({ 'Vendor A': { discount_a_1: false } });
    expect(hiddenRows).toEqual({ sw_payroll: true });
  });
});

describe('diffAnalyses computed rows', () => {
  it('flags subtotal and Totals rows as computed and leaves them out of the count', () => {
    const before = makeResult();
    before.comparisonTable.sections[0].rows.push({ id: 'sw_sub', label: 'Software Subtotal', isSubtotal: true, values: [cell(96000), cell(78000)] });
    before.comparisonTable.sections.push({ name: 'Totals', rows: [{ id: 'year1', label: 'Year 1', isSubtotal: true, values: [cell(96000), cell(78000)] }] });

    const after = structuredClone(before);
    after.comparisonTable.sections[0].rows[1].values[0] = cell(40000);
    after.comparisonTable.sections[0].rows[2].values[0] = cell(100000);
    after.comparisonTable.sections[2].rows[0].values[0] = cell(100000);

    const diff = diffAnalyses(before, after);
    expect(diff.changeCount).toBe(1);
    expect(diff.sections[0].changed.map((r) => [r.rowId, !!r.computed])).toEqual([
      ['sw_payroll', false],
      ['sw_sub', true],
    ]);
    expect(diff.sections[1].changed[0].computed).toBe(true);
  });
});
