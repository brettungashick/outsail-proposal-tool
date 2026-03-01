import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    analysisId,
    projectId,
    vendorName,
    rowId,
    sectionName,
    vendorIndex,
    editType,
    oldDisplay,
    oldAmount,
    oldStatus,
    newDisplay,
    newAmount,
    newStatus,
    rowLabel,
    reasonTag,
  } = body;

  // Validate required fields
  if (!analysisId || !projectId || !vendorName || !rowId || !sectionName || !editType || !rowLabel) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate editType
  if (!['value_change', 'status_change', 'label_change'].includes(editType)) {
    return NextResponse.json({ error: 'Invalid editType' }, { status: 400 });
  }

  // Verify user has access to this analysis
  const hasAccess = await requireAnalysisAccess(analysisId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const event = await prisma.learningEvent.create({
    data: {
      analysisId,
      projectId,
      vendorName,
      rowId,
      sectionName,
      vendorIndex: vendorIndex ?? 0,
      editType,
      oldDisplay: oldDisplay ?? '',
      oldAmount: oldAmount ?? null,
      oldStatus: oldStatus ?? null,
      newDisplay: newDisplay ?? '',
      newAmount: newAmount ?? null,
      newStatus: newStatus ?? null,
      rowLabel,
      reasonTag: reasonTag ?? null,
      userId: sessionUser.id,
    },
  });

  return NextResponse.json(event, { status: 201 });
}

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const vendorName = searchParams.get('vendorName');
  const editType = searchParams.get('editType');
  const analysisId = searchParams.get('analysisId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  // Build filters
  const where: Record<string, unknown> = {};
  if (vendorName) where.vendorName = vendorName;
  if (editType) where.editType = editType;
  if (analysisId) where.analysisId = analysisId;

  // Non-admins can only see events from their own projects
  if (sessionUser.role !== 'admin') {
    const userProjects = await prisma.project.findMany({
      where: { advisorId: sessionUser.id },
      select: { id: true },
    });
    where.projectId = { in: userProjects.map((p) => p.id) };
  }

  const events = await prisma.learningEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(events);
}
