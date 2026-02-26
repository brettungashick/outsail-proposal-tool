'use client';

import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    clientName: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    _count: {
      documents: number;
      analyses: number;
    };
  };
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  analyzing: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
};

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:border-slate-300 transition cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-slate-900 text-lg">{project.name}</h3>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[project.status] || statusColors.draft}`}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-4">Client: {project.clientName}</p>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>{project._count.documents} document{project._count.documents !== 1 ? 's' : ''}</span>
          <span>{project._count.analyses} analysis{project._count.analyses !== 1 ? 'es' : ''}</span>
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
