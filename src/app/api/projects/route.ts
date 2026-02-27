import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;
  const scope = req.nextUrl.searchParams.get('scope') || 'mine';

  let whereClause = {};
  if (scope === 'team') {
    whereClause = { advisorId: { not: userId } };
  } else if (scope === 'all' && userRole === 'admin') {
    whereClause = {};
  } else {
    // Default: mine
    whereClause = { advisorId: userId };
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      advisor: { select: { id: true, name: true, email: true } },
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

  // Auto-generate project name: "ClientName Month YY"
  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const autoName = `${body.clientName} ${monthNames[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;

  const project = await prisma.project.create({
    data: {
      name: autoName,
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      advisorId: userId,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
