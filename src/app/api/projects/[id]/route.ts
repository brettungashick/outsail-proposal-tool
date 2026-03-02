import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireProjectAccess } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireProjectAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

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

    const isOwner = project.advisorId === sessionUser.id;
    const isAdmin = sessionUser.role === 'admin';

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

    const isOwner = project.advisorId === sessionUser.id;
    const isAdmin = sessionUser.role === 'admin';

    return NextResponse.json({ ...project, shareLinks: [], isOwner, isAdmin });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireProjectAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const body = await req.json();

  await prisma.project.update({
    where: { id: params.id },
    data: {
      name: body.name,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      status: body.status,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireProjectAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
