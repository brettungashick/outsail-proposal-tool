import { ComparisonTable, CellStatus } from '@/types';

export interface PlaybookRule {
  id: string;
  vendorName: string; // Vendor.name or "*" for global
  name: string;
  conditionType: 'contains' | 'regex';
  conditionValue: string;
  conditionField: 'label' | 'section' | 'display';
  actionType: 'set_status' | 'add_note';
  actionValue: string; // JSON string
  confidence: 'sure' | 'maybe';
  enabled: boolean;
  version: number;
}

/**
 * Test whether a rule's condition matches a given cell context.
 */
export function matchesCondition(
  rule: PlaybookRule,
  context: { label: string; sectionName: string; display: string }
): boolean {
  const fieldValue = rule.conditionField === 'label'
    ? context.label
    : rule.conditionField === 'section'
      ? context.sectionName
      : context.display;

  if (rule.conditionType === 'contains') {
    return fieldValue.toLowerCase().includes(rule.conditionValue.toLowerCase());
  }

  // regex
  try {
    const re = new RegExp(rule.conditionValue, 'i');
    return re.test(fieldValue);
  } catch {
    return false;
  }
}

const VALID_STATUSES: CellStatus[] = [
  'currency', 'included', 'included_in_bundle', 'not_included', 'tbc', 'na', 'hidden',
];

const STATUS_DISPLAY: Record<CellStatus, string> = {
  currency: '',
  tbc: 'To be confirmed',
  included: 'Included',
  included_in_bundle: 'Included in bundle',
  not_included: 'Not included',
  na: 'N/A',
  hidden: 'Hidden',
};

/**
 * Apply a rule's action to a cell, mutating it in place.
 * Returns true if the cell was modified.
 */
export function applyAction(
  rule: PlaybookRule,
  cell: { display: string; amount: number | null; note: string | null; status?: CellStatus; isConfirmed: boolean; audit?: { sources: unknown[]; override: unknown; formula: string | null; playbookRuleId?: string; playbookRuleVersion?: number } }
): boolean {
  let parsed: string;
  try {
    parsed = JSON.parse(rule.actionValue);
  } catch {
    return false;
  }

  if (rule.actionType === 'set_status') {
    const newStatus = parsed as CellStatus;
    if (!VALID_STATUSES.includes(newStatus)) return false;

    cell.status = newStatus;
    cell.display = STATUS_DISPLAY[newStatus] || cell.display;
    cell.amount = null;
    cell.isConfirmed = newStatus !== 'tbc';

    if (!cell.audit) cell.audit = { sources: [], override: null, formula: null };
    cell.audit.playbookRuleId = rule.id;
    cell.audit.playbookRuleVersion = rule.version;
    return true;
  }

  if (rule.actionType === 'add_note') {
    const existingNote = cell.note || '';
    const noteText = String(parsed);
    // Don't duplicate notes
    if (!existingNote.includes(noteText)) {
      cell.note = existingNote ? `${existingNote}; ${noteText}` : noteText;
    }

    if (!cell.audit) cell.audit = { sources: [], override: null, formula: null };
    cell.audit.playbookRuleId = rule.id;
    cell.audit.playbookRuleVersion = rule.version;
    return true;
  }

  return false;
}

/**
 * Apply all matching playbook rules to a comparison table.
 * Manual overrides (cells with audit.override set) are never touched.
 * Returns the count of cells modified.
 */
export function applyPlaybookRules(
  table: ComparisonTable,
  rules: PlaybookRule[]
): number {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return 0;

  let modified = 0;

  for (const section of table.sections) {
    for (const row of section.rows) {
      if (row.isSubtotal) continue;

      for (let vi = 0; vi < row.values.length; vi++) {
        const val = row.values[vi];
        const vendorName = table.vendors[vi];

        // Skip cells with manual overrides — human always wins
        if (val.audit?.override) continue;

        for (const rule of enabledRules) {
          // Check vendor scope: rule applies if vendorName matches or rule is global ("*")
          if (rule.vendorName !== '*' && rule.vendorName !== vendorName) continue;

          const context = {
            label: row.label,
            sectionName: section.name,
            display: val.display,
          };

          if (matchesCondition(rule, context)) {
            if (applyAction(rule, val)) {
              modified++;
              break; // First matching rule wins per cell
            }
          }
        }
      }
    }
  }

  return modified;
}
