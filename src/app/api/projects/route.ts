import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const projects = await prisma.project.findMany({
    where: { advisorId: userId },
    include: {
      _count: {
        select: { documents: true, analyses: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      advisorId: userId,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
