import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireProjectAccess } from '@/lib/access';
import { extractTextFromBuffer, getFileType } from '@/lib/file-parser';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const vendorName = formData.get('vendorName') as string;
  const projectId = formData.get('projectId') as string;
  const documentType = (formData.get('documentType') as string) || 'initial_quote';

  if (!file || !vendorName || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const hasAccess = await requireProjectAccess(projectId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const fileType = getFileType(file.name);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let rawText = '';
  try {
    rawText = await extractTextFromBuffer(buffer, fileType);
  } catch (error) {
    console.error('Text extraction error:', error);
    rawText = 'Error extracting text from file';
  }

  let quoteVersion = 1;
  if (documentType === 'updated_quote') {
    const existingVersions = await prisma.document.findMany({
      where: { projectId, vendorName, documentType: 'updated_quote' },
      orderBy: { quoteVersion: 'desc' },
      take: 1,
    });
    const maxExisting = existingVersions[0]?.quoteVersion || 0;
    quoteVersion = maxExisting + 1;

    await prisma.document.updateMany({
      where: {
        projectId,
        vendorName,
        documentType: 'initial_quote',
      },
      data: { isActive: false },
    });

    await prisma.document.updateMany({
      where: {
        projectId,
        vendorName,
        documentType: 'updated_quote',
      },
      data: { isActive: false },
    });
  }

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

  // Return without rawText to avoid exposing large text in response
  return NextResponse.json({
    id: document.id,
    projectId: document.projectId,
    vendorName: document.vendorName,
    fileName: document.fileName,
    fileType: document.fileType,
    documentType: document.documentType,
    quoteVersion: document.quoteVersion,
    isActive: document.isActive,
    uploadedAt: document.uploadedAt,
  }, { status: 201 });
}
