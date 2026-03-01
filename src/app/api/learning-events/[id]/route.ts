import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { promotedToRuleId } = body;

  if (!promotedToRuleId) {
    return NextResponse.json({ error: 'promotedToRuleId is required' }, { status: 400 });
  }

  // Verify the event exists and belongs to this user
  const event = await prisma.learningEvent.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.userId !== sessionUser.id && sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.learningEvent.update({
    where: { id },
    data: { promotedToRuleId },
  });

  return NextResponse.json(updated);
}
