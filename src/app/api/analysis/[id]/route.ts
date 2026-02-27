import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
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
      editedBy: userId,
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
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.analysis.update({
      where: { id: params.id },
      data: updateData,
    });
  }

  return NextResponse.json({ success: true });
}
