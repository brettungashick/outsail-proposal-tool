'use client';

import { formatDate } from '@/lib/utils';

interface Document {
  id: string;
  vendorName: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  parsedData: string | null;
  documentType?: string;
  quoteVersion?: number;
  isActive?: boolean;
}

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onToggleActive?: (id: string, isActive: boolean) => void;
  readOnly?: boolean;
}

const typeIcons: Record<string, string> = {
  pdf: 'PDF',
  xlsx: 'XLS',
  xls: 'XLS',
  csv: 'CSV',
  docx: 'DOC',
  doc: 'DOC',
  txt: 'TXT',
};

const docTypeBadge: Record<string, { label: string; color: string }> = {
  initial_quote: { label: 'Initial', color: 'bg-blue-50 text-blue-700' },
  supplemental: { label: 'Supplemental', color: 'bg-amber-50 text-amber-700' },
  updated_quote: { label: 'Revision', color: 'bg-purple-50 text-purple-700' },
};

function getDocTypeLabel(doc: Document) {
  const badge = docTypeBadge[doc.documentType || 'initial_quote'] || docTypeBadge.initial_quote;
  let label = badge.label;
  if (doc.documentType === 'updated_quote' && doc.quoteVersion && doc.quoteVersion > 1) {
    label = `Revision v${doc.quoteVersion}`;
  }
  return { label, color: badge.color };
}

export default function DocumentList({ documents, onDelete, onToggleActive, readOnly }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No documents uploaded yet. Upload vendor proposals above.
      </div>
    );
  }

  // Group documents by vendor
  const grouped = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    if (!acc[doc.vendorName]) acc[doc.vendorName] = [];
    acc[doc.vendorName].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([vendor, docs]) => (
        <div key={vendor}>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">{vendor}</h3>
          <div className="space-y-2">
            {docs.map((doc) => {
              const { label, color } = getDocTypeLabel(doc);
              const isActive = doc.isActive !== false; // Default true for old docs

              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between border rounded-lg px-4 py-3 transition ${
                    isActive
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {typeIcons[doc.fileType] || 'FILE'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{doc.fileName}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{label}</span>
                        {!isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{formatDate(doc.uploadedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.parsedData ? (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        Parsed
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                        Pending
                      </span>
                    )}
                    {!readOnly && onToggleActive && (
                      <button
                        onClick={() => onToggleActive(doc.id, !isActive)}
                        className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded transition"
                        title={isActive ? 'Exclude from comparison' : 'Include in comparison'}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => onDelete(doc.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
