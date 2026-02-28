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
    advisor?: { id: string; name: string; email: string };
    _count: {
      documents: number;
      analyses: number;
    };
  };
  showAdvisor?: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  analyzing: 'bg-amber-50 text-amber-700',
  complete: 'bg-green-50 text-green-700',
};

const statusDots: Record<string, string> = {
  draft: 'bg-slate-400',
  analyzing: 'bg-amber-400',
  complete: 'bg-green-500',
};

export default function ProjectCard({ project, showAdvisor }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-outsail-blue/30 transition cursor-pointer group">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-slate-900 group-hover:text-outsail-blue-dark transition">{project.name}</h3>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${statusColors[project.status] || statusColors.draft}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDots[project.status] || statusDots.draft}`} />
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
        <div className="flex gap-4 text-xs text-slate-400 mb-1">
          <span>{project._count.documents} document{project._count.documents !== 1 ? 's' : ''}</span>
          <span>{project._count.analyses} analysis{project._count.analyses !== 1 ? 'es' : ''}</span>
        </div>
        <p className="text-xs text-slate-400">Updated {formatDate(project.updatedAt)}</p>
        {showAdvisor && project.advisor && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-outsail-blue/20 flex items-center justify-center text-xs font-medium text-outsail-blue">
                {project.advisor.name.charAt(0)}
              </div>
              <span className="text-xs text-slate-500">{project.advisor.name}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
