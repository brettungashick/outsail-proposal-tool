import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { name, logoUrl, accentColor } = body;

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
      ...(accentColor !== undefined && { accentColor: accentColor || null }),
    },
  });

  return NextResponse.json(vendor);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await prisma.vendor.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
