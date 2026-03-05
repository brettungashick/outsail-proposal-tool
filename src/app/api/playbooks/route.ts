import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

function toVendorKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// One-time migration: ensure vendorKey column exists in Turso
let _migrated = false;
async function ensurePlaybookColumns() {
  if (_migrated) return;
  try { await prisma.$executeRawUnsafe(`ALTER TABLE "VendorPlaybookRule" ADD COLUMN "vendorKey" TEXT`); } catch { /* exists */ }
  _migrated = true;
}

const playbookCreateSchema = z.object({
  vendorName: z.string().min(1),
  name: z.string().min(1),
  conditionType: z.enum(['contains', 'regex']),
  conditionValue: z.string().min(1),
  conditionField: z.enum(['label', 'section', 'display']),
  actionType: z.enum(['set_status', 'add_note']),
  actionValue: z.string().min(1).refine((v) => {
    try { JSON.parse(v); return true; } catch { return false; }
  }, 'actionValue must be valid JSON'),
  examples: z.string().nullable().optional(),
  confidence: z.enum(['sure', 'maybe']).optional().default('sure'),
  createdFromEventId: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const vendorName = searchParams.get('vendorName');
  const enabledParam = searchParams.get('enabled');

  const where: Record<string, unknown> = {};
  if (vendorName) where.vendorName = vendorName;
  if (enabledParam !== null && enabledParam !== undefined) {
    where.enabled = enabledParam === 'true';
  }

  const rules = await prisma.vendorPlaybookRule.findMany({
    where,
    orderBy: [{ vendorName: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  await ensurePlaybookColumns();

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = playbookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Validate regex compiles
  if (data.conditionType === 'regex') {
    try {
      new RegExp(data.conditionValue, 'i');
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }
  }

  const rule = await prisma.vendorPlaybookRule.create({
    data: {
      vendorName: data.vendorName,
      vendorKey: toVendorKey(data.vendorName),
      name: data.name,
      conditionType: data.conditionType,
      conditionValue: data.conditionValue,
      conditionField: data.conditionField,
      actionType: data.actionType,
      actionValue: data.actionValue,
      examples: data.examples ?? null,
      confidence: data.confidence,
      createdBy: sessionUser.id,
      createdFromEventId: data.createdFromEventId ?? null,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
