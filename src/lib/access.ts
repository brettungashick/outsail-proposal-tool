import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Get the current session user. Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { id?: string; email?: string; role?: string };
  if (!user.id) return null;
  return { id: user.id, email: user.email || '', role: user.role || 'advisor' };
}

/**
 * Extract the domain part from an email address.
 */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
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

/**
 * Check if a user has access to a share link.
 * Requires auth. Allows: project owner, admin, or user whose email domain matches allowedDomain.
 */
export async function requireShareAccess(
  token: string,
  sessionUser: SessionUser
): Promise<{ allowed: boolean; reason?: string; shareLink?: { id: string; projectId: string; email: string; allowedDomain: string; accessMode: string; expiresAt: Date } }> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: { project: { select: { advisorId: true } } },
  });

  if (!shareLink) {
    return { allowed: false, reason: 'Invalid share link' };
  }

  if (new Date() > shareLink.expiresAt) {
    return { allowed: false, reason: 'Share link has expired' };
  }

  // Project owner or admin always has access
  if (sessionUser.role === 'admin' || shareLink.project.advisorId === sessionUser.id) {
    return { allowed: true, shareLink };
  }

  // Exact email match
  if (sessionUser.email.toLowerCase() === shareLink.email.toLowerCase()) {
    return { allowed: true, shareLink };
  }

  // Domain match
  if (shareLink.allowedDomain && shareLink.accessMode === 'domain') {
    const userDomain = emailDomain(sessionUser.email);
    if (userDomain && userDomain === shareLink.allowedDomain.toLowerCase()) {
      return { allowed: true, shareLink };
    }
  }

  return { allowed: false, reason: 'Your account does not have access to this shared link' };
}

/**
 * Return the base URL from APP_URL env var, falling back to NEXTAUTH_URL / VERCEL_URL.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
