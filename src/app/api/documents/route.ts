import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromBuffer, getFileType } from '@/lib/file-parser';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const vendorName = formData.get('vendorName') as string;
  const projectId = formData.get('projectId') as string;

  if (!file || !vendorName || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify project belongs to user
  const project = await prisma.project.findFirst({
    where: { id: projectId, advisorId: userId },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const fileType = getFileType(file.name);

  // Extract text from file in memory (no disk write needed)
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let rawText = '';
  try {
    rawText = await extractTextFromBuffer(buffer, fileType);
  } catch (error) {
    console.error('Text extraction error:', error);
    rawText = 'Error extracting text from file';
  }

  // Save to database
  const document = await prisma.document.create({
    data: {
      projectId,
      vendorName,
      fileName: file.name,
      filePath: file.name, // Original filename for display (no file on disk)
      fileType,
      rawText,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
