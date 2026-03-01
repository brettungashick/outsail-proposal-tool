import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireDocumentAccess } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireDocumentAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const document = await prisma.document.findUnique({
    where: { id: params.id },
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
