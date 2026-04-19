import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export async function GET(
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

  // Verify document access: document must belong to a project owned by the user (or user is admin)
  const document = await prisma.document.findFirst({
    where: {
      id,
      project: userRole === 'admin' ? {} : { advisorId: userId },
    },
    select: {
      rawText: true,
      fileName: true,
    },
  });

  if (!document || !document.rawText) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const start = parseInt(url.searchParams.get('start') || '0', 10);
  const end = parseInt(url.searchParams.get('end') || '0', 10);
  const context = Math.min(500, Math.max(0, parseInt(url.searchParams.get('context') || '100', 10)));

  // Validate bounds
  if (isNaN(start) || isNaN(end) || start < 0 || end < start || end > document.rawText.length) {
    return NextResponse.json({ error: 'Invalid bounds' }, { status: 400 });
  }

  const contextStart = Math.max(0, start - context);
  const contextEnd = Math.min(document.rawText.length, end + context);
  const snippet = document.rawText.substring(contextStart, contextEnd);

  return NextResponse.json({
    snippet,
    highlightStart: start - contextStart,
    highlightEnd: end - contextStart,
    fileName: document.fileName,
  });
}
