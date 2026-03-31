import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;
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
  if (event.userId !== userId && userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.learningEvent.update({
    where: { id },
    data: { promotedToRuleId },
  });

  return NextResponse.json(updated);
}
