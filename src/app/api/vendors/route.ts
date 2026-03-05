import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';
import { vendorCreateSchema, validateBody } from '@/lib/schemas';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(vendors);
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
  const validated = validateBody(vendorCreateSchema, body);
  if (!validated.success) return validated.response;

  const { name, logoUrl, accentColor } = validated.data;

  try {
    const vendor = await prisma.vendor.create({
      data: {
        name,
        logoUrl: logoUrl || null,
        accentColor: accentColor || null,
      },
    });
    return NextResponse.json(vendor, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Vendor name already exists' }, { status: 409 });
  }
}
