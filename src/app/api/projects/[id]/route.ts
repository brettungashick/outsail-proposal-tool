import { NextRequest, NextResponse } from 'next/server';
import { projectWhereOwnerOrAdmin } from '@/lib/auth';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { validateBody, projectUpdateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;

  try {
    // Try full query including shareLinks
    const project = await prisma.project.findFirst({
      where: { id: params.id },
      include: {
        advisor: { select: { id: true, name: true, email: true } },
        documents: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true, projectId: true, vendorName: true, fileName: true,
            filePath: true, fileType: true, documentType: true,
            quoteVersion: true, isActive: true, uploadedAt: true,
          },
        },
        analyses: { orderBy: { version: 'desc' }, take: 1 },
        shareLinks: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.advisorId === userId;
    const isAdmin = userRole === 'admin';

    return NextResponse.json({ ...project, isOwner, isAdmin });
  } catch (err) {
    // Fallback: shareLinks columns may not exist yet (run GET /api/seed to migrate)
    console.error('Project query failed, retrying without shareLinks:', err);
    const project = await prisma.project.findFirst({
      where: { id: params.id },
      include: {
        advisor: { select: { id: true, name: true, email: true } },
        documents: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true, projectId: true, vendorName: true, fileName: true,
            filePath: true, fileType: true, documentType: true,
            quoteVersion: true, isActive: true, uploadedAt: true,
          },
        },
        analyses: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.advisorId === userId;
    const isAdmin = userRole === 'admin';

    return NextResponse.json({ ...project, shareLinks: [], isOwner, isAdmin });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;
  const body = await req.json();
  const validated = validateBody(projectUpdateSchema, body);
  if (!validated.success) return validated.response;

  const project = await prisma.project.updateMany({
    where: projectWhereOwnerOrAdmin(params.id, userId, userRole),
    data: {
      name: validated.data.name,
      clientName: validated.data.clientName,
      clientEmail: validated.data.clientEmail,
      status: validated.data.status,
    },
  });

  if (project.count === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;

  const project = await prisma.project.findFirst({
    where: projectWhereOwnerOrAdmin(params.id, userId, userRole),
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Only the owner or an admin can delete
  if (project.advisorId !== userId && userRole !== 'admin') {
    return NextResponse.json({ error: 'Only the project owner or an admin can delete this project' }, { status: 403 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
