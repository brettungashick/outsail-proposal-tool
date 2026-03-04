import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';

const ALLOWED_FIELD_TYPES = [
  'comparisonData',
  'standardizationNotes',
  'vendorNotes',
  'nextSteps',
  'discountToggles',
  'hiddenRows',
] as const;

const analysisUpdateSchema = z.object({
  fieldPath: z.string().min(1, 'fieldPath is required'),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  fieldType: z.enum(ALLOWED_FIELD_TYPES, {
    error: `fieldType must be one of: ${ALLOWED_FIELD_TYPES.join(', ')}`,
  }),
});

// Cap stored audit values at 4KB; store hash if larger
const MAX_AUDIT_VALUE_SIZE = 4 * 1024;

function capValue(value: unknown): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= MAX_AUDIT_VALUE_SIZE) return str;
  const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);
  return `[truncated:${hash}:${str.length}bytes]`;
}

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

  // Validate request body
  const body = await req.json();
  const parsed = analysisUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { fieldPath, oldValue, newValue, fieldType } = parsed.data;

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
      editedBy: sessionUser.id,
    },
  });

  return NextResponse.json({ success: true });
}
