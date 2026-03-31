export type CellStatus = 'currency' | 'included' | 'included_in_bundle' | 'not_included' | 'tbc' | 'na' | 'hidden';

export interface VendorValue {
  amount: number | null;
  display: string;
  note: string | null;
  citation: Citation | null;
  isConfirmed: boolean;
  status?: CellStatus;
  isManualOverride?: boolean;
  audit?: CellAudit;
}

export interface TableRow {
  id: string;
  label: string;
  values: VendorValue[];
  isSubtotal?: boolean;
  isDiscount?: boolean;
  isPepm?: boolean;
}

export interface TableSection {
  id?: string; // Stable section ID (optional for backward compat)
  name: string;
  rows: TableRow[];
}

export interface ComparisonTable {
  vendors: string[];
  normalizedHeadcount: number;
  sections: TableSection[];
  auditLog?: CellAuditEvent[];
  headcountGrowthY2?: number; // percentage, e.g. 5 for 5%
  headcountGrowthY3?: number;
}

export interface Citation {
  documentId: string;
  documentName: string;
  vendorName: string;
  excerpt: string;
}

export interface AnalysisResult {
  comparisonTable: ComparisonTable;
  standardizationNotes: string[];
  vendorNotes: Record<string, string[]>;
  nextSteps: string[];
  citations: Citation[];
}

export interface ParsedDiscount {
  id: string;
  name: string;
  amount: number | null;
  type: 'percentage' | 'flat' | 'unknown';
  percentageValue: number | null;
  rawText: string;
  appliesToYear?: number | null;
}

export interface ParsedProposal {
  vendorName: string;
  documentId: string;
  documentName: string;
  headcount: number | null;
  contractTermMonths: number | null;
  modules: ParsedModule[];
  implementationItems: ParsedLineItem[];
  serviceItems: ParsedLineItem[];
  discounts: ParsedDiscount[];
  notableTerms: string[];
  unknowns: string[];
}

export interface ParsedModule {
  name: string;
  description: string;
  feeAmount: number | null;
  feeType: string;
  isRange: boolean;
  rangeMin: number | null;
  rangeMax: number | null;
  rawText: string;
}

export interface ParsedLineItem {
  name: string;
  amount: number | null;
  feeType: string;
  isOneTime: boolean;
  isRecurring: boolean;
  rawText: string;
  isRange: boolean;
  rangeMin: number | null;
  rangeMax: number | null;
}

// Discount toggle state: { "VendorName": { "discountId": true/false } }
export type DiscountToggles = Record<string, Record<string, boolean>>;

// Hidden row toggle state: { "rowId": true } — rows hidden for standardization
export type HiddenRows = Record<string, boolean>;

export interface SourcePointer {
  documentId: string;
  documentName: string;
  vendorName: string;
  label: string;
  charOffsetStart: number;
  charOffsetEnd: number;
}

export interface CellAudit {
  sources: SourcePointer[];
  override: { oldDisplay: string; oldAmount: number | null; userId: string; timestamp: string } | null;
  formula: string | null;
  playbookRuleId?: string;
  playbookRuleVersion?: number;
}

export interface CellAuditEvent {
  type: string;
  timestamp: string;
  cellPath: string;
  userId: string | null;
  display: string;
  amount: number | null;
}

export interface ClarifyingQuestion {
  id: string;
  category: 'missing_data' | 'ambiguity' | 'discrepancy' | 'assumption' | 'general';
  vendorName: string | null;
  question: string;
  context: string;
  suggestedDefault: string | null;
}
