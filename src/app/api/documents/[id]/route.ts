import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!document || document.project.advisorId !== userId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (typeof body.isActive === 'boolean') {
    // Clear parsedData when toggling active status so it gets re-parsed
    await prisma.document.update({
      where: { id: params.id },
      data: { isActive: body.isActive, parsedData: null },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!document || document.project.advisorId !== userId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
