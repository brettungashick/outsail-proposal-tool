import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rule = await prisma.vendorPlaybookRule.findUnique({
    where: { id: params.id },
  });

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const existing = await prisma.vendorPlaybookRule.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
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
    enabled,
  } = body;

  // Validate conditionType if provided
  if (conditionType && !['contains', 'regex'].includes(conditionType)) {
    return NextResponse.json({ error: 'Invalid conditionType' }, { status: 400 });
  }

  // Validate conditionField if provided
  if (conditionField && !['label', 'section', 'display'].includes(conditionField)) {
    return NextResponse.json({ error: 'Invalid conditionField' }, { status: 400 });
  }

  // Validate actionType if provided (v1)
  if (actionType && !['set_status', 'add_note'].includes(actionType)) {
    return NextResponse.json({ error: 'Invalid actionType' }, { status: 400 });
  }

  // Validate actionValue is valid JSON if provided
  if (actionValue) {
    try {
      JSON.parse(actionValue);
    } catch {
      return NextResponse.json({ error: 'actionValue must be valid JSON' }, { status: 400 });
    }
  }

  // If regex, validate it compiles
  if ((conditionType || existing.conditionType) === 'regex' && conditionValue) {
    try {
      new RegExp(conditionValue, 'i');
    } catch {
      return NextResponse.json({ error: 'Invalid regex pattern' }, { status: 400 });
    }
  }

  // Determine if rule content changed (not just enabled toggle)
  const contentChanged = vendorName || name || conditionType || conditionValue ||
    conditionField || actionType || actionValue;

  const rule = await prisma.vendorPlaybookRule.update({
    where: { id: params.id },
    data: {
      ...(vendorName !== undefined && { vendorName }),
      ...(name !== undefined && { name }),
      ...(conditionType !== undefined && { conditionType }),
      ...(conditionValue !== undefined && { conditionValue }),
      ...(conditionField !== undefined && { conditionField }),
      ...(actionType !== undefined && { actionType }),
      ...(actionValue !== undefined && { actionValue }),
      ...(examples !== undefined && { examples }),
      ...(confidence !== undefined && { confidence }),
      ...(enabled !== undefined && { enabled }),
      // Bump version only if rule content changed
      ...(contentChanged && { version: existing.version + 1 }),
    },
  });

  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const existing = await prisma.vendorPlaybookRule.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  await prisma.vendorPlaybookRule.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
