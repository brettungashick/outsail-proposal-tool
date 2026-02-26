export interface VendorValue {
  amount: number | null;
  display: string;
  note: string | null;
  citation: Citation | null;
  isConfirmed: boolean;
}

export interface TableRow {
  id: string;
  label: string;
  values: VendorValue[];
  isSubtotal?: boolean;
}

export interface TableSection {
  name: string;
  rows: TableRow[];
}

export interface ComparisonTable {
  vendors: string[];
  normalizedHeadcount: number;
  sections: TableSection[];
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

export interface ParsedProposal {
  vendorName: string;
  documentId: string;
  documentName: string;
  headcount: number | null;
  contractTermMonths: number | null;
  modules: ParsedModule[];
  implementationItems: ParsedLineItem[];
  serviceItems: ParsedLineItem[];
  discounts: string[];
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
