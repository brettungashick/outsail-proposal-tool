import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { validateBody, learningEventPatchSchema } from '@/lib/schemas';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;
  const { id } = await params;
  const body = await req.json();
  const validated = validateBody(learningEventPatchSchema, body);
  if (!validated.success) return validated.response;
  const { promotedToRuleId } = validated.data;

  // Verify the event exists and belongs to this user
  const event = await prisma.learningEvent.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.userId !== userId && userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.learningEvent.update({
    where: { id },
    data: { promotedToRuleId },
  });

  return NextResponse.json(updated);
}
