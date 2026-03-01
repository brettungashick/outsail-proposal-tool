import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    return NextResponse.json({ logoUrl: settings?.logoUrl || null });
  } catch {
    return NextResponse.json({ logoUrl: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (sessionUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PNG, JPEG, SVG, or WebP' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const logoUrl = `data:${file.type};base64,${base64}`;

    await prisma.appSettings.upsert({
      where: { id: 'app' },
      update: { logoUrl },
      create: { id: 'app', logoUrl },
    });

    return NextResponse.json({ logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
