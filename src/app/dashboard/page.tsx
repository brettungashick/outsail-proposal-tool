'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ProjectCard from '@/components/ProjectCard';

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  advisorId: string;
  advisor?: { id: string; name: string; email: string };
  _count: { documents: number; analyses: number };
}

type SortBy = 'date_desc' | 'date_asc' | 'name_asc' | 'status';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [teamProjects, setTeamProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({ clientName: '', clientEmail: '' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date_desc');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchProjects();
  }, [status]);

  const fetchProjects = async () => {
    const [mineRes, teamRes] = await Promise.all([
      fetch('/api/projects?scope=mine'),
      fetch('/api/projects?scope=team'),
    ]);
    if (mineRes.ok) setMyProjects(await mineRes.json());
    if (teamRes.ok) setTeamProjects(await teamRes.json());
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject),
    });
    if (res.ok) {
      const project = await res.json();
      setShowModal(false);
      setNewProject({ clientName: '', clientEmail: '' });
      router.push(`/projects/${project.id}`);
    }
    setCreating(false);
  };

  const filterAndSort = (projects: Project[]) => {
    let filtered = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.advisor?.name?.toLowerCase().includes(q)
      );
    }
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'name_asc':
          return a.clientName.localeCompare(b.clientName);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  const filteredMine = filterAndSort(myProjects);
  const filteredTeam = filterAndSort(teamProjects);
  const userRole = (session?.user as { role?: string })?.role;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">Manage client proposal evaluations</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + New Project
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="name_asc">Client Name A-Z</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* My Projects */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">My Projects</h2>
          {filteredMine.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <div className="text-slate-400 text-lg mb-2">
                {search ? 'No matching projects' : 'No projects yet'}
              </div>
              {!search && (
                <p className="text-sm text-slate-400">Create your first project to get started</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMine.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        {/* Team Projects */}
        {filteredTeam.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Team Projects
              <span className="text-sm font-normal text-slate-400 ml-2">
                {userRole === 'admin' ? 'Full access' : 'View only'}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeam.map((project) => (
                <ProjectCard key={project.id} project={project} showAdvisor />
              ))}
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={newProject.clientName}
                    onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="e.g., Thatcher"
                    required
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Project will be named &ldquo;{newProject.clientName || 'Company'} {new Date().toLocaleString('default', { month: 'long' })} {String(new Date().getFullYear()).slice(-2)}&rdquo;
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
