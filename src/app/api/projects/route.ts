import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { validateBody, projectCreateSchema } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const body = await req.json();
  const validated = validateBody(projectCreateSchema, body);
  if (!validated.success) return validated.response;

  // Auto-generate project name: "ClientName Month YY"
  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const autoName = `${validated.data.clientName} ${monthNames[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;

  const project = await prisma.project.create({
    data: {
      name: autoName,
      clientName: validated.data.clientName,
      clientEmail: validated.data.clientEmail || null,
      advisorId: userId,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
