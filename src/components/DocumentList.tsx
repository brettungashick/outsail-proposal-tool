'use client';

import { formatDate } from '@/lib/utils';

interface Document {
  id: string;
  vendorName: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  parsedData: string | null;
}

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
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

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No documents uploaded yet. Upload vendor proposals above.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {typeIcons[doc.fileType] || 'FILE'}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">{doc.vendorName}</p>
              <p className="text-xs text-slate-400">
                {doc.fileName} &middot; {formatDate(doc.uploadedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {doc.parsedData ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Parsed</span>
            ) : (
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                Pending
              </span>
            )}
            <button
              onClick={() => onDelete(doc.id)}
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
