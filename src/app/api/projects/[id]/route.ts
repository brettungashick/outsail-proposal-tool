import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;

  // Allow any authenticated advisor to read any project (team access)
  const project = await prisma.project.findFirst({
    where: { id: params.id },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      analyses: { orderBy: { version: 'desc' }, take: 1 },
      shareLinks: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Include ownership info for the client
  const isOwner = project.advisorId === userId;
  const isAdmin = userRole === 'admin';

  return NextResponse.json({ ...project, isOwner, isAdmin });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const project = await prisma.project.updateMany({
    where: { id: params.id, advisorId: userId },
    data: {
      name: body.name,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      status: body.status,
    },
  });

  if (project.count === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const project = await prisma.project.findFirst({
    where: { id: params.id, advisorId: userId },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
