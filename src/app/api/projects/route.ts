import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get('scope') || 'mine';

  let whereClause = {};
  if (scope === 'team' || scope === 'all') {
    // All advisors can see team projects (excluding their own for 'team' scope)
    whereClause = scope === 'team' ? { advisorId: { not: sessionUser.id } } : {};
  } else {
    // 'mine' scope — only own projects
    whereClause = { advisorId: sessionUser.id };
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
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const autoName = `${body.clientName} ${monthNames[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;

  const project = await prisma.project.create({
    data: {
      name: autoName,
      clientName: body.clientName,
      clientEmail: body.clientEmail || null,
      advisorId: sessionUser.id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
