'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import ShareManager from '@/components/ShareManager';
import ClarifyingReview from '@/components/ClarifyingReview';

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

interface Analysis {
  id: string;
  version: number;
  status?: string;
  clarifyingQuestions?: string | null;
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
  isOwner?: boolean;
  isAdmin?: boolean;
  advisor?: { id: string; name: string; email: string };
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/login');
  }, [authStatus, router]);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      // Auto-switch to analysis tab if project is in clarifying state
      if (data.status === 'clarifying') {
        setActiveTab('analysis');
      }
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

  const handleToggleActive = async (docId: string, isActive: boolean) => {
    await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
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

  const handleFinalized = () => {
    fetchProject();
    router.push(`/projects/${projectId}/analysis`);
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      router.push('/dashboard');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Delete failed');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">Loading...</div>
      </Sidebar>
    );
  }

  if (!project) {
    return (
      <Sidebar>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
          Project not found
        </div>
      </Sidebar>
    );
  }

  const latestAnalysis = project.analyses[0] || null;
  const isClarifying = latestAnalysis?.status === 'clarifying';
  const isComplete = latestAnalysis && latestAnalysis.status !== 'clarifying';
  const canEdit = project.isOwner || project.isAdmin;

  return (
    <Sidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-outsail-blue hover:text-outsail-blue-dark mb-2 inline-block"
          >
            ← Back to Projects
          </button>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                {!canEdit && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">View Only</span>
                )}
                {isClarifying && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Needs Review</span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Client: {project.clientName}
                {project.advisor && !project.isOwner && (
                  <span className="ml-2 text-slate-400">· Advisor: {project.advisor.name}</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              {canEdit && project.documents.length >= 2 && !isClarifying && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
                >
                  {analyzing
                    ? 'Analyzing... (this may take a minute)'
                    : isComplete
                      ? 'Re-generate Analysis'
                      : 'Generate Analysis'}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="border border-red-200 text-red-500 px-3 py-2 rounded-lg text-sm hover:bg-red-50 transition"
                  title="Delete Project"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
              {isComplete && (
                <button
                  onClick={() => router.push(`/projects/${projectId}/analysis`)}
                  className="border border-outsail-blue text-outsail-blue px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-blue/5 transition"
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
                    ? 'border-outsail-blue-dark text-outsail-blue-dark'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'analysis' && isClarifying ? 'Review & Finalize' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'documents' && ` (${project.documents.length})`}
                {tab === 'analysis' && isClarifying && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'documents' && (
          <div className={`grid grid-cols-1 ${canEdit ? 'lg:grid-cols-3' : ''} gap-6`}>
            {canEdit && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Upload Proposal</h2>
                  <FileUpload projectId={projectId} onUploadComplete={fetchProject} />
                </div>
              </div>
            )}
            <div className={canEdit ? 'lg:col-span-2' : ''}>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-900 mb-4">Uploaded Documents</h2>
                <DocumentList
                  documents={project.documents}
                  onDelete={handleDeleteDocument}
                  onToggleActive={handleToggleActive}
                  readOnly={!canEdit}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div>
            {isClarifying && latestAnalysis ? (
              <ClarifyingReview
                analysisId={latestAnalysis.id}
                projectId={projectId}
                questionsJson={latestAnalysis.clarifyingQuestions || '[]'}
                documents={project.documents.map((d) => ({
                  id: d.id,
                  vendorName: d.vendorName,
                  fileName: d.fileName,
                  documentType: d.documentType || 'initial_quote',
                  isActive: d.isActive !== false,
                }))}
                onFinalized={handleFinalized}
                onDocumentsChanged={fetchProject}
                readOnly={!canEdit}
              />
            ) : isComplete ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Analysis v{latestAnalysis!.version}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Generated on{' '}
                      {new Date(latestAnalysis!.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/analysis`)}
                    className="bg-outsail-blue-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-outsail-navy transition"
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
                    className="bg-outsail-blue-dark text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-outsail-navy transition disabled:opacity-50"
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Delete Project</h3>
                <p className="text-sm text-slate-500">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <span className="font-medium">&ldquo;{project.name}&rdquo;</span>? All
              documents, analyses, and share links will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
