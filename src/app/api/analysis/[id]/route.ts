import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { validateBody, analysisUpdateSchema } from '@/lib/schemas';

// Cap stored audit values at 4KB; store hash if larger
const MAX_AUDIT_VALUE_SIZE = 4 * 1024;

function capValue(value: unknown): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= MAX_AUDIT_VALUE_SIZE) return str;
  const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);
  return `[truncated:${hash}:${str.length}bytes]`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const userId = user.id;
  const body = await req.json();
  const validated = validateBody(analysisUpdateSchema, body);
  if (!validated.success) return validated.response;

  const { fieldPath, oldValue, newValue, fieldType } = validated.data;

  // Validate the analysis exists
  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Build update payload
  const newValueStr = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
  const updateData: Record<string, string> = { [fieldType]: newValueStr };

  // Update FIRST, then log — so edits are only logged on success
  await prisma.analysis.update({
    where: { id: params.id },
    data: updateData,
  });

  // Log the edit with capped values
  await prisma.analysisEdit.create({
    data: {
      analysisId: params.id,
      fieldPath: fieldType === 'comparisonData' ? (fieldPath || 'comparisonData') : fieldPath,
      oldValue: capValue(oldValue),
      newValue: capValue(newValue),
      editedBy: userId,
    },
  });

  return NextResponse.json({ success: true });
}
