import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (params.id === sessionUser.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

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
