import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/access';

// One-time migration: ensure faviconUrl column exists in Turso
let _migrated = false;
async function ensureFaviconColumn() {
  if (_migrated) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AppSettings" ADD COLUMN "faviconUrl" TEXT`);
  } catch { /* column already exists */ }
  _migrated = true;
}

export async function GET() {
  try {
    await ensureFaviconColumn();
    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    return NextResponse.json({ faviconUrl: settings?.faviconUrl || null });
  } catch {
    return NextResponse.json({ faviconUrl: null });
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
    const file = formData.get('favicon') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/png', 'image/x-icon', 'image/svg+xml', 'image/webp', 'image/vnd.microsoft.icon'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File must be PNG, ICO, SVG, or WebP' }, { status: 400 });
    }

    if (file.size > 512 * 1024) {
      return NextResponse.json({ error: 'File must be under 512KB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const faviconUrl = `data:${file.type};base64,${base64}`;

    await ensureFaviconColumn();
    await prisma.appSettings.upsert({
      where: { id: 'app' },
      update: { faviconUrl },
      create: { id: 'app', faviconUrl },
    });

    return NextResponse.json({ faviconUrl });
  } catch (err) {
    console.error('Favicon upload error:', err);
    return NextResponse.json({ error: 'Failed to upload favicon' }, { status: 500 });
  }
}
