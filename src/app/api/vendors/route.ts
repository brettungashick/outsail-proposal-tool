import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

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
  const { name, logoUrl, accentColor } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
  }

  try {
    const vendor = await prisma.vendor.create({
      data: {
        name: name.trim(),
        logoUrl: logoUrl || null,
        accentColor: accentColor || null,
      },
    });
    return NextResponse.json(vendor, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Vendor name already exists' }, { status: 409 });
  }
}
