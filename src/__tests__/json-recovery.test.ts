/**
 * Tests for the JSON extraction/repair helpers in claude.ts.
 *
 * These cover the two production failures seen on 2026-08-31:
 * - "Failed to parse vendor ADP: Expected ',' or '}' after property value in
 *   JSON at position 9615" — parseProposal's response hit max_tokens mid-object.
 * - "Failed to parse vendor Dayforce: Unterminated string in JSON at position
 *   9878" — same cause, cut off inside a string value.
 */

import { describe, it, expect } from 'vitest';
import { extractJsonPayload, repairTruncatedJson } from '@/lib/json-recovery';

describe('extractJsonPayload', () => {
  it('returns plain JSON unchanged', () => {
    expect(extractJsonPayload('{"a":1}')).toBe('{"a":1}');
  });

  it('strips markdown code fences', () => {
    expect(extractJsonPayload('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonPayload('```\n[1,2]\n```')).toBe('[1,2]');
  });

  it('drops prose before and after the value', () => {
    const text = 'Here is the result:\n{"a":1}\nLet me know if you need changes.';
    expect(extractJsonPayload(text)).toBe('{"a":1}');
  });

  it('does not stop at a brace inside a string', () => {
    const text = '{"rawText":"Fee schedule {see appendix}","a":1} trailing';
    expect(JSON.parse(extractJsonPayload(text))).toEqual({
      rawText: 'Fee schedule {see appendix}',
      a: 1,
    });
  });

  it('picks a top-level array when it comes first', () => {
    expect(extractJsonPayload('[{"id":"q1"}]')).toBe('[{"id":"q1"}]');
  });

  it('leaves truncated text intact for the repair pass', () => {
    const text = '{"modules":[{"name":"Payroll"},{"name":"Ben';
    expect(extractJsonPayload(text)).toBe(text);
  });
});

describe('repairTruncatedJson', () => {
  it('returns null for complete JSON', () => {
    expect(repairTruncatedJson('{"a":1}')).toBeNull();
  });

  it('recovers an object cut off after a property value (the ADP failure)', () => {
    const truncated =
      '{"vendorName":"ADP","headcount":500,"modules":[' +
      '{"name":"Core HR","feeAmount":12,"feeType":"PEPM"},' +
      '{"name":"Payroll","feeAmount":8';
    const repaired = repairTruncatedJson(truncated)!;
    expect(repaired).not.toBeNull();
    const parsed = JSON.parse(repaired);
    expect(parsed.vendorName).toBe('ADP');
    expect(parsed.headcount).toBe(500);
    // The complete module survives; the half-written one is dropped.
    expect(parsed.modules).toHaveLength(1);
    expect(parsed.modules[0].name).toBe('Core HR');
  });

  it('recovers an object cut off inside a string (the Dayforce failure)', () => {
    const truncated =
      '{"vendorName":"Dayforce","modules":[' +
      '{"name":"Core HR","rawText":"Core HR bundle at $12 PEPM"},' +
      '{"name":"Payroll","rawText":"Payroll processing incl';
    const parsed = JSON.parse(repairTruncatedJson(truncated)!);
    expect(parsed.vendorName).toBe('Dayforce');
    expect(parsed.modules).toHaveLength(1);
    expect(parsed.modules[0].rawText).toBe('Core HR bundle at $12 PEPM');
  });

  it('recovers a truncated top-level array', () => {
    const truncated = '[{"id":"q1","question":"Confirm headcount"},{"id":"q2","ques';
    const parsed = JSON.parse(repairTruncatedJson(truncated)!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('q1');
  });

  it('recovers deeply nested truncation', () => {
    const truncated =
      '{"comparisonTable":{"vendors":["A","B"],"sections":[' +
      '{"name":"Software Fees (Recurring)","rows":[' +
      '{"id":"core_hr","values":[{"amount":1000},{"amount":2000}]},' +
      '{"id":"payroll","values":[{"amount":50';
    const parsed = JSON.parse(repairTruncatedJson(truncated)!);
    expect(parsed.comparisonTable.vendors).toEqual(['A', 'B']);
    expect(parsed.comparisonTable.sections[0].rows).toHaveLength(1);
    expect(parsed.comparisonTable.sections[0].rows[0].values).toHaveLength(2);
  });

  it('is not fooled by braces or commas inside strings', () => {
    const truncated =
      '{"notes":["Fee applies per {employee}, per month","Second, complete note"],"more":"cut o';
    const parsed = JSON.parse(repairTruncatedJson(truncated)!);
    expect(parsed.notes).toEqual([
      'Fee applies per {employee}, per month',
      'Second, complete note',
    ]);
    expect(parsed.more).toBeUndefined();
  });

  it('is not fooled by escaped quotes inside strings', () => {
    const truncated = '{"a":"he said \\"hi\\", then left","b":"trunc';
    const parsed = JSON.parse(repairTruncatedJson(truncated)!);
    expect(parsed.a).toBe('he said "hi", then left');
  });

  it('returns null when nothing complete was written', () => {
    expect(repairTruncatedJson('{"vendorNam')).toBeNull();
  });
});
