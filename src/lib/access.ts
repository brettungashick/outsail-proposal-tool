import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
  id: string;
  role: string;
}

/**
 * Get the current session user. Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { id?: string; role?: string };
  if (!user.id) return null;
  return { id: user.id, role: user.role || 'advisor' };
}

/**
 * Check if a user has access to a project (owner or admin).
 */
export async function requireProjectAccess(
  projectId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { advisorId: true },
  });
  if (!project) return false;
  return project.advisorId === userId;
}

/**
 * Check if a user has access to an analysis (via project ownership or admin).
 */
export async function requireAnalysisAccess(
  analysisId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { project: { select: { advisorId: true } } },
  });
  if (!analysis) return false;
  return analysis.project.advisorId === userId;
}

/**
 * Check if a user has access to a document (via project ownership or admin).
 */
export async function requireDocumentAccess(
  documentId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { project: { select: { advisorId: true } } },
  });
  if (!document) return false;
  return document.project.advisorId === userId;
}
