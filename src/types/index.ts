export type CellStatus = 'currency' | 'included' | 'included_in_bundle' | 'not_included' | 'tbc' | 'na' | 'hidden';

export interface SourcePointer {
  documentId: string;
  documentName: string;
  vendorName: string;
  label: string;
  charOffsetStart: number; // -1 if not located
  charOffsetEnd: number;   // -1 if not located
}

export interface OverrideMetadata {
  overriddenBy: string;
  overriddenAt: string;
  priorDisplay: string;
  priorAmount: number | null;
}

export interface CellAudit {
  sources: SourcePointer[];
  override: OverrideMetadata | null;
  formula: string | null;
}

export interface CellAuditEvent {
  type: 'extraction_set_cell' | 'user_override_cell';
  timestamp: string;
  cellPath: string;
  userId: string | null;
  display: string;
  amount: number | null;
}

export interface VendorValue {
  amount: number | null;
  display: string;
  note: string | null;
  citation: Citation | null;
  isConfirmed: boolean;
  status?: CellStatus;
  audit?: CellAudit;
}

export interface TableRow {
  id: string;
  label: string;
  values: VendorValue[];
  isSubtotal?: boolean;
  isDiscount?: boolean;
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
  appliesToYear?: number | null; // null = all years, 1 = first year only, etc.
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

export interface ClarifyingQuestion {
  id: string;
  category: 'missing_data' | 'ambiguity' | 'discrepancy' | 'assumption' | 'general';
  vendorName: string | null; // null = applies to all vendors
  question: string;
  context: string; // explanation of why this matters
  suggestedDefault: string | null; // AI's best guess if advisor skips
}
