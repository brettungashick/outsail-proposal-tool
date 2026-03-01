'use client';

import { CellAudit } from '@/types';

interface CellAuditTooltipProps {
  audit: CellAudit;
}

export default function CellAuditTooltip({ audit }: CellAuditTooltipProps) {
  const lines: string[] = [];

  if (audit.sources.length > 0) {
    lines.push(`Source: ${audit.sources[0].label}`);
  }

  if (audit.formula) {
    lines.push('Auto-calculated');
  }

  if (audit.override) {
    const date = new Date(audit.override.overriddenAt).toLocaleDateString();
    lines.push(`Overridden on ${date}`);
    lines.push(`Prior: ${audit.override.priorDisplay}`);
  }

  if (lines.length === 0) return null;

  return (
    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
    </div>
  );
}
