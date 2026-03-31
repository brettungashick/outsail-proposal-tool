import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { validateBody, vendorUpdateSchema } from '@/lib/schemas';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = user.role;
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(vendorUpdateSchema, body);
  if (!validated.success) return validated.response;

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...(validated.data.name !== undefined && { name: validated.data.name }),
      ...(validated.data.logoUrl !== undefined && { logoUrl: validated.data.logoUrl || null }),
      ...(validated.data.accentColor !== undefined && { accentColor: validated.data.accentColor || null }),
    },
  });

  return NextResponse.json(vendor);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = user.role;
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await prisma.vendor.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
