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
  const documentType = (formData.get('documentType') as string) || 'initial_quote';

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

  // Compute quoteVersion for updated quotes
  let quoteVersion = 1;
  if (documentType === 'updated_quote') {
    const existingVersions = await prisma.document.findMany({
      where: { projectId, vendorName, documentType: 'updated_quote' },
      orderBy: { quoteVersion: 'desc' },
      take: 1,
    });
    const maxExisting = existingVersions[0]?.quoteVersion || 0;
    quoteVersion = maxExisting + 1;

    // When uploading an updated quote, deactivate previous initial quotes for this vendor
    await prisma.document.updateMany({
      where: {
        projectId,
        vendorName,
        documentType: 'initial_quote',
      },
      data: { isActive: false },
    });

    // Deactivate previous updated quotes for this vendor
    await prisma.document.updateMany({
      where: {
        projectId,
        vendorName,
        documentType: 'updated_quote',
      },
      data: { isActive: false },
    });
  }

  // Save to database
  const document = await prisma.document.create({
    data: {
      projectId,
      vendorName,
      fileName: file.name,
      filePath: file.name,
      fileType,
      rawText,
      documentType,
      quoteVersion,
      isActive: true,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
