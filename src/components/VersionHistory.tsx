'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface Edit {
  id: string;
  fieldPath: string;
  oldValue: string;
  newValue: string;
  editedBy: string;
  editedAt: string;
}

interface Version {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
}

interface VersionHistoryProps {
  analysisId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectVersion: (versionId: string) => void;
}

export default function VersionHistory({
  analysisId,
  isOpen,
  onClose,
  onSelectVersion,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && analysisId) {
      setLoading(true);
      fetch(`/api/analysis/${analysisId}/versions`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setVersions(data.versions);
            setEdits(data.edits);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, analysisId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900">Version History</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Versions */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Analysis Versions</h3>
              <div className="space-y-2">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVersion(v.id)}
                    className="w-full text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg px-4 py-3 transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-800">
                        Version {v.version}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(v.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Edits */}
            {edits.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">
                  Recent Edits (Current Version)
                </h3>
                <div className="space-y-2">
                  {edits.map((edit) => (
                    <div
                      key={edit.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3"
                    >
                      <div className="text-xs text-slate-400 mb-1">
                        {formatDate(edit.editedAt)}
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">{edit.fieldPath}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-red-500 line-through">
                          {edit.oldValue.substring(0, 50)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-green-600">
                          {edit.newValue.substring(0, 50)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
