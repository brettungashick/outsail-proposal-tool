'use client';

import { useState, useRef, useEffect } from 'react';

interface FileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
}

interface VendorOption {
  id: string;
  name: string;
  accentColor: string | null;
}

const DOCUMENT_TYPES = [
  { value: 'initial_quote', label: 'Initial Quote' },
  { value: 'supplemental', label: 'Supplemental Info' },
  { value: 'updated_quote', label: 'Updated/Revised Quote' },
];

export default function FileUpload({ projectId, onUploadComplete }: FileUploadProps) {
  const [vendorName, setVendorName] = useState('');
  const [documentType, setDocumentType] = useState('initial_quote');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const vendorInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = '.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt';

  useEffect(() => {
    fetch('/api/vendors')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setVendors(data))
      .catch(() => {});
  }, []);

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(vendorName.toLowerCase())
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !vendorName.trim()) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('vendorName', vendorName.trim());
    formData.append('projectId', projectId);
    formData.append('documentType', documentType);

    try {
      const res = await fetch('/api/documents', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
      setVendorName('');
      setDocumentType('initial_quote');
      setFile(null);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
        <input
          ref={vendorInputRef}
          type="text"
          value={vendorName}
          onChange={(e) => {
            setVendorName(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="e.g., BambooHR, Paylocity, Rippling"
          required
        />
        {showSuggestions && vendorName && filteredVendors.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredVendors.map((v) => (
              <button
                key={v.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setVendorName(v.name);
                  setShowSuggestions(false);
                }}
              >
                {v.accentColor && (
                  <span
                    className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                    style={{ backgroundColor: v.accentColor }}
                  />
                )}
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : file
              ? 'border-green-400 bg-green-50'
              : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        {file ? (
          <div>
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-green-600 mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500">
              Drag & drop a proposal file, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports PDF, Excel, Word, CSV, and text files
            </p>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      <button
        type="submit"
        disabled={uploading || !file || !vendorName.trim()}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading & Processing...' : 'Upload Proposal'}
      </button>
    </form>
  );
}
