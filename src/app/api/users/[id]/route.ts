import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as { role?: string }).role;
  const userId = (session.user as { id: string }).id;

  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Don't allow deleting yourself
  if (params.id === userId) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if user has projects — reassign or block
  const projectCount = await prisma.project.count({ where: { advisorId: params.id } });
  if (projectCount > 0) {
    return NextResponse.json(
      { error: `This advisor has ${projectCount} project(s). Reassign or delete them first.` },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
