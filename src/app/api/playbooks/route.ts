import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

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
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const {
    vendorName,
    name,
    conditionType,
    conditionValue,
    conditionField,
    actionType,
    actionValue,
    examples,
    confidence,
    createdFromEventId,
  } = body;

  // Validate required fields
  if (!vendorName || !name || !conditionType || !conditionValue || !conditionField || !actionType || !actionValue) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate conditionType
  if (!['contains', 'regex'].includes(conditionType)) {
    return NextResponse.json({ error: 'Invalid conditionType (must be contains or regex)' }, { status: 400 });
  }

  // Validate conditionField
  if (!['label', 'section', 'display'].includes(conditionField)) {
    return NextResponse.json({ error: 'Invalid conditionField (must be label, section, or display)' }, { status: 400 });
  }

  // Validate actionType (v1: set_status and add_note only)
  if (!['set_status', 'add_note'].includes(actionType)) {
    return NextResponse.json({ error: 'Invalid actionType (v1 supports set_status and add_note)' }, { status: 400 });
  }

  // Validate actionValue is valid JSON
  try {
    JSON.parse(actionValue);
  } catch {
    return NextResponse.json({ error: 'actionValue must be valid JSON' }, { status: 400 });
  }

  // If regex, validate it compiles
  if (conditionType === 'regex') {
    try {
      new RegExp(conditionValue, 'i');
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }
  }

  const rule = await prisma.vendorPlaybookRule.create({
    data: {
      vendorName,
      name,
      conditionType,
      conditionValue,
      conditionField,
      actionType,
      actionValue,
      examples: examples ?? null,
      confidence: confidence ?? 'sure',
      createdBy: sessionUser.id,
      createdFromEventId: createdFromEventId ?? null,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
