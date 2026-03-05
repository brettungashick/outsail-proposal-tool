'use client';

import { CellAudit, Citation } from '@/types';

interface CellAuditTooltipProps {
  audit: CellAudit;
  citation?: Citation | null;
}

export default function CellAuditTooltip({ audit, citation }: CellAuditTooltipProps) {
  const lines: { text: string; italic?: boolean }[] = [];

  if (audit.sources.length > 0) {
    lines.push({ text: `Source: ${audit.sources[0].label}` });
  }

  // Show excerpt snippet if available — gives specific context
  if (citation?.excerpt) {
    const truncated = citation.excerpt.length > 80
      ? citation.excerpt.substring(0, 80) + '…'
      : citation.excerpt;
    lines.push({ text: `"${truncated}"`, italic: true });
  }

  if (audit.formula) {
    lines.push({ text: 'Auto-calculated' });
  }

  if (audit.override) {
    const date = new Date(audit.override.overriddenAt).toLocaleDateString();
    lines.push({ text: `Overridden on ${date}` });
    lines.push({ text: `Prior: ${audit.override.priorDisplay}` });
  }

  if (lines.length === 0) return null;

  return (
    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg max-w-xs pointer-events-none">
      {lines.map((line, i) => (
        <div key={i} className={`${line.italic ? 'italic text-slate-300' : ''} ${i > 0 ? 'mt-0.5' : ''}`}>
          {line.text}
        </div>
      ))}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  );
}
