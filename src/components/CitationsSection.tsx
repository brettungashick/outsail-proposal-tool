'use client';

import { Citation } from '@/types';

interface CitationsSectionProps {
  citations: Citation[];
}

export default function CitationsSection({ citations }: CitationsSectionProps) {
  if (!citations || citations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Citations</h3>
        <p className="text-sm text-slate-400">No citations available.</p>
      </div>
    );
  }

  // Group citations by vendor
  const grouped: Record<string, Citation[]> = {};
  for (const citation of citations) {
    if (!grouped[citation.vendorName]) grouped[citation.vendorName] = [];
    grouped[citation.vendorName].push(citation);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Citations & Source References</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Audit trail mapping analysis data to source documents
        </p>
      </div>
      <div className="p-6 space-y-4">
        {Object.entries(grouped).map(([vendor, cites]) => (
          <div key={vendor}>
            <h4 className="font-medium text-sm text-slate-800 mb-2">{vendor}</h4>
            <div className="space-y-1.5">
              {cites.map((cite, idx) => (
                <div key={idx} className="text-xs text-slate-500 flex items-start gap-2">
                  <span className="text-slate-300">[{idx + 1}]</span>
                  <div>
                    <span className="text-slate-600">Source: </span>
                    <span className="font-medium text-slate-700">{cite.documentName}</span>
                    {cite.excerpt && (
                      <p className="text-slate-400 mt-0.5 italic">
                        &ldquo;{cite.excerpt.substring(0, 200)}
                        {cite.excerpt.length > 200 ? '...' : ''}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
