import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;

  // Fetch document with project info for authorization
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    select: {
      rawText: true,
      fileName: true,
      project: { select: { advisorId: true } },
    },
  });

  if (!document || !document.rawText) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Authorization: user must be the project advisor or an admin
  if (document.project.advisorId !== userId && userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
