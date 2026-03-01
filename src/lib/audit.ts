import { ComparisonTable, ParsedProposal, SourcePointer, CellAuditEvent } from '@/types';

/**
 * Find character offsets of a snippet within full text.
 * Returns { start, end } or { -1, -1 } if not found.
 */
export function findCharOffsets(
  fullText: string,
  snippet: string
): { start: number; end: number } {
  if (!fullText || !snippet) return { start: -1, end: -1 };

  // Try exact match first
  const idx = fullText.indexOf(snippet);
  if (idx !== -1) return { start: idx, end: idx + snippet.length };

  // Fuzzy fallback: normalize whitespace + lowercase
  const normFull = fullText.replace(/\s+/g, ' ').toLowerCase();
  const normSnip = snippet.replace(/\s+/g, ' ').toLowerCase().trim();
  if (normSnip.length < 10) return { start: -1, end: -1 }; // Too short for fuzzy
  const fuzzyIdx = normFull.indexOf(normSnip);
  if (fuzzyIdx !== -1) return { start: fuzzyIdx, end: fuzzyIdx + normSnip.length };

  return { start: -1, end: -1 };
}

/**
 * Post-process the generated comparison table to populate SourcePointer data
 * on each cell by matching citation excerpts against proposal raw text.
 */
export function augmentAuditData(
  table: ComparisonTable,
  proposals: ParsedProposal[]
): void {
  // Build a map of vendorName -> proposal for quick lookup
  const vendorProposalMap: Record<string, ParsedProposal> = {};
  for (const p of proposals) {
    vendorProposalMap[p.vendorName] = p;
  }

  for (let si = 0; si < table.sections.length; si++) {
    const section = table.sections[si];
    for (let ri = 0; ri < section.rows.length; ri++) {
      const row = section.rows[ri];
      for (let vi = 0; vi < row.values.length; vi++) {
        const val = row.values[vi];
        const vendorName = table.vendors[vi];
        const proposal = vendorProposalMap[vendorName];

        // Initialize audit if not present
        if (!val.audit) {
          val.audit = { sources: [], override: null, formula: null };
        }

        // Build source pointer from citation if available
        if (val.citation && proposal) {
          const pointer: SourcePointer = {
            documentId: val.citation.documentId || proposal.documentId,
            documentName: val.citation.documentName || proposal.documentName,
            vendorName: val.citation.vendorName || vendorName,
            label: val.citation.documentName || `${vendorName} Proposal`,
            charOffsetStart: -1,
            charOffsetEnd: -1,
          };

          // Try to find the excerpt in the document text
          // We don't have the full raw text here, so offsets stay -1
          // The excerpt itself serves as a reference
          if (val.citation.excerpt) {
            pointer.label = `${vendorName} Proposal`;
          }

          val.audit.sources = [pointer];
        } else if (proposal && !row.isSubtotal) {
          // Even without citation, record the source document
          val.audit.sources = [{
            documentId: proposal.documentId,
            documentName: proposal.documentName,
            vendorName,
            label: `${vendorName} Proposal`,
            charOffsetStart: -1,
            charOffsetEnd: -1,
          }];
        }
      }
    }
  }
}

/**
 * Augment source pointers with actual character offsets by matching
 * citation excerpts against document raw text.
 */
export function augmentWithDocumentText(
  table: ComparisonTable,
  documentTexts: Record<string, string> // documentId -> rawText
): void {
  for (const section of table.sections) {
    for (const row of section.rows) {
      for (const val of row.values) {
        if (!val.audit?.sources) continue;
        for (const source of val.audit.sources) {
          if (source.charOffsetStart !== -1) continue; // Already has offsets
          const fullText = documentTexts[source.documentId];
          if (!fullText || !val.citation?.excerpt) continue;
          const offsets = findCharOffsets(fullText, val.citation.excerpt);
          source.charOffsetStart = offsets.start;
          source.charOffsetEnd = offsets.end;
        }
      }
    }
  }
}

/**
 * Create initial extraction_set_cell audit events for all data cells.
 */
export function buildInitialAuditLog(table: ComparisonTable): CellAuditEvent[] {
  const events: CellAuditEvent[] = [];
  const timestamp = new Date().toISOString();

  for (let si = 0; si < table.sections.length; si++) {
    const section = table.sections[si];
    for (let ri = 0; ri < section.rows.length; ri++) {
      const row = section.rows[ri];
      if (row.isSubtotal) continue; // Skip computed rows
      for (let vi = 0; vi < row.values.length; vi++) {
        const val = row.values[vi];
        events.push({
          type: 'extraction_set_cell',
          timestamp,
          cellPath: `sections[${si}].rows[${ri}].values[${vi}]`,
          userId: null,
          display: val.display,
          amount: val.amount,
        });
      }
    }
  }

  return events;
}
