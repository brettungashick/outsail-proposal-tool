import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { validateBody, documentUpdateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const body = await req.json();
  const validated = validateBody(documentUpdateSchema, body);
  if (!validated.success) return validated.response;

  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!document || document.project.advisorId !== userId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Clear parsedData when toggling active status so it gets re-parsed
  await prisma.document.update({
    where: { id: params.id },
    data: { isActive: validated.data.isActive, parsedData: null },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

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
