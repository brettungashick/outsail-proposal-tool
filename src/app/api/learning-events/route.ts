import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';

function toVendorKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// One-time migration: ensure new columns exist in Turso
let _migrated = false;
async function ensureLearningEventColumns() {
  if (_migrated) return;
  const addCol = async (col: string, def: string) => {
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "LearningEvent" ADD COLUMN "${col}" ${def}`); } catch { /* exists */ }
  };
  await addCol('vendorKey', 'TEXT');
  await addCol('colId', 'TEXT');
  await addCol('cellId', 'TEXT');
  _migrated = true;
}

const learningEventSchema = z.object({
  analysisId: z.string().min(1),
  projectId: z.string().min(1),
  vendorName: z.string().min(1),
  rowId: z.string().min(1),
  colId: z.string().optional(),
  sectionName: z.string().min(1),
  vendorIndex: z.number().int().nonnegative().optional().default(0),
  editType: z.enum(['value_change', 'status_change', 'label_change']),
  oldDisplay: z.string().optional().default(''),
  oldAmount: z.number().nullable().optional(),
  oldStatus: z.string().nullable().optional(),
  newDisplay: z.string().optional().default(''),
  newAmount: z.number().nullable().optional(),
  newStatus: z.string().nullable().optional(),
  rowLabel: z.string().min(1),
  reasonTag: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  await ensureLearningEventColumns();

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = learningEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Verify user has access to this analysis
  const hasAccess = await requireAnalysisAccess(data.analysisId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Derive stable identifiers
  const vendorKey = toVendorKey(data.vendorName);
  const colId = data.colId || `v${data.vendorIndex}`;
  const cellId = `${data.analysisId}:${vendorKey}:${data.rowId}:${colId}`;

  const event = await prisma.learningEvent.create({
    data: {
      analysisId: data.analysisId,
      projectId: data.projectId,
      vendorName: data.vendorName,
      vendorKey,
      rowId: data.rowId,
      colId,
      cellId,
      sectionName: data.sectionName,
      vendorIndex: data.vendorIndex,
      editType: data.editType,
      oldDisplay: data.oldDisplay,
      oldAmount: data.oldAmount ?? null,
      oldStatus: data.oldStatus ?? null,
      newDisplay: data.newDisplay,
      newAmount: data.newAmount ?? null,
      newStatus: data.newStatus ?? null,
      rowLabel: data.rowLabel,
      reasonTag: data.reasonTag ?? null,
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
