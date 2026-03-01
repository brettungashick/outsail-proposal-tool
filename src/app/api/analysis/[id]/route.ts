import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
    include: {
      edits: { orderBy: { editedAt: 'desc' } },
      project: true,
    },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  return NextResponse.json(analysis);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { fieldPath, oldValue, newValue, fieldType } = body;

  // Validate the analysis exists
  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Record the edit
  await prisma.analysisEdit.create({
    data: {
      analysisId: params.id,
      fieldPath,
      oldValue: String(oldValue),
      newValue: String(newValue),
      editedBy: sessionUser.id,
    },
  });

  // Update the relevant field in the analysis
  const updateData: Record<string, string> = {};

  if (fieldType === 'comparisonData') {
    updateData.comparisonData = newValue;
  } else if (fieldType === 'standardizationNotes') {
    updateData.standardizationNotes = newValue;
  } else if (fieldType === 'vendorNotes') {
    updateData.vendorNotes = newValue;
  } else if (fieldType === 'nextSteps') {
    updateData.nextSteps = newValue;
  } else if (fieldType === 'discountToggles') {
    updateData.discountToggles = newValue;
  } else if (fieldType === 'hiddenRows') {
    updateData.hiddenRows = newValue;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.analysis.update({
      where: { id: params.id },
      data: updateData,
    });
  }

  return NextResponse.json({ success: true });
}
