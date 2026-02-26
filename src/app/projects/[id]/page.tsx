'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import ShareManager from '@/components/ShareManager';

interface Document {
  id: string;
  vendorName: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  parsedData: string | null;
}

interface Analysis {
  id: string;
  version: number;
  createdAt: string;
}

interface ShareLink {
  id: string;
  token: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string | null;
  status: string;
  documents: Document[];
  analyses: Analysis[];
  shareLinks: ShareLink[];
}

export default function ProjectPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'documents' | 'analysis' | 'sharing'>('documents');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchProject();
  }, [authStatus, fetchProject]);

  const handleDeleteDocument = async (docId: string) => {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    fetchProject();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }
      await fetchProject();
      setActiveTab('analysis');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
          Project not found
        </div>
      </div>
    );
  }

  const latestAnalysis = project.analyses[0] || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Back to Projects
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <p className="text-sm text-slate-500">Client: {project.clientName}</p>
            </div>
            <div className="flex gap-3">
              {project.documents.length >= 2 && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {analyzing
                    ? 'Analyzing... (this may take a minute)'
                    : latestAnalysis
                      ? 'Re-generate Analysis'
                      : 'Generate Analysis'}
                </button>
              )}
              {latestAnalysis && (
                <button
                  onClick={() => router.push(`/projects/${projectId}/analysis`)}
                  className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
                >
                  View Analysis
                </button>
              )}
            </div>
          </div>
        </div>

        {analyzeError && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {analyzeError}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex gap-8">
            {(['documents', 'analysis', 'sharing'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'documents' && ` (${project.documents.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-900 mb-4">Upload Proposal</h2>
                <FileUpload projectId={projectId} onUploadComplete={fetchProject} />
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-900 mb-4">Uploaded Documents</h2>
                <DocumentList
                  documents={project.documents}
                  onDelete={handleDeleteDocument}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div>
            {latestAnalysis ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Analysis v{latestAnalysis.version}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Generated on{' '}
                      {new Date(latestAnalysis.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/analysis`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Open Full Analysis
                  </button>
                </div>
                <p className="text-sm text-slate-500">
                  Click &ldquo;Open Full Analysis&rdquo; to view the complete comparison table, notes, and
                  citations.
                </p>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-slate-400 mb-4">No analysis generated yet</p>
                {project.documents.length < 2 ? (
                  <p className="text-sm text-slate-400">
                    Upload at least 2 vendor proposals to generate a comparison
                  </p>
                ) : (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Generate Analysis'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sharing' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Share with Client</h2>
            <p className="text-sm text-slate-500 mb-6">
              Generate a magic link for your client to view the comparison read-only. Links expire
              after 30 days.
            </p>
            <ShareManager
              projectId={projectId}
              shareLinks={project.shareLinks}
              onRefresh={fetchProject}
            />
          </div>
        )}
      </div>
    </div>
  );
}
