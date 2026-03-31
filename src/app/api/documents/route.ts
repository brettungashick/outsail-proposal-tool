import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions, projectWhereOwnerOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractTextFromBuffer, getFileType } from '@/lib/file-parser';

// Configurable via env, default 15MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10) * 1024 * 1024;

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  csv: ['text/csv', 'application/csv'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  doc: ['application/msword'],
  txt: ['text/plain'],
};

const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const userRole = (session.user as { role?: string }).role;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const pastedRawText = formData.get('rawText') as string | null;
  const vendorName = formData.get('vendorName') as string;
  const projectId = formData.get('projectId') as string;
  const documentType = (formData.get('documentType') as string) || 'initial_quote';
  const fileName = (formData.get('fileName') as string) || '';

  if ((!file && !pastedRawText) || !vendorName || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify project belongs to user or user is admin
  const project = await prisma.project.findFirst({
    where: projectWhereOwnerOrAdmin(projectId, userId, userRole),
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let fileSize: number | null = null;
  let rawText = '';
  let fileType = 'text';
  let resolvedFileName = fileName;
  let extractionWarning: string | null = null;

  if (pastedRawText) {
    // Pasted text input — no file parsing needed
    rawText = pastedRawText;
    fileSize = Buffer.byteLength(pastedRawText, 'utf-8');
    resolvedFileName = resolvedFileName || `${vendorName} - Pasted Content.txt`;

    // Enforce size limit on pasted text too
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `Pasted text exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }, { status: 413 });
    }
  } else if (file) {
    fileSize = file.size;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }, { status: 413 });
    }

    // Validate file extension
    fileType = getFileType(file.name);
    if (!ALLOWED_EXTENSIONS.includes(fileType) && fileType !== 'unknown') {
      // Allow unknown for backward compat but warn
    } else if (fileType === 'unknown') {
      return NextResponse.json({
        error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      }, { status: 415 });
    }

    resolvedFileName = resolvedFileName || file.name;
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
      where: { projectId, vendorName, documentType: 'initial_quote' },
      data: { isActive: false },
    });

    // Deactivate previous updated quotes for this vendor
    await prisma.document.updateMany({
      where: { projectId, vendorName, documentType: 'updated_quote' },
      data: { isActive: false },
    });
  }

  // Create document record in "uploaded" state
  const document = await prisma.document.create({
    data: {
      projectId,
      vendorName,
      fileName: resolvedFileName,
      filePath: resolvedFileName,
      fileType,
      fileSize,
      documentType,
      quoteVersion,
      isActive: true,
      ingestionStatus: 'uploaded',
    },
  });

  // Parse file content (track status)
  if (file) {
    try {
      await prisma.document.update({
        where: { id: document.id },
        data: { ingestionStatus: 'parsing' },
      });

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      rawText = await extractTextFromBuffer(buffer, fileType);

      // Validate extraction produced meaningful content
      if (!rawText || rawText.trim().length < 50) {
        extractionWarning =
          'Text extraction produced little or no content. The file may be image-based (scanned), password-protected, or corrupted. The AI analysis may produce incomplete results for this vendor.';
        rawText = '';
      }

      await prisma.document.update({
        where: { id: document.id },
        data: { rawText, ingestionStatus: 'parsed' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      console.error('Text extraction error:', error);
      extractionWarning =
        'Failed to extract text from this file. The AI analysis may produce incomplete results for this vendor. Consider re-uploading in a different format.';

      await prisma.document.update({
        where: { id: document.id },
        data: {
          ingestionStatus: 'failed',
          ingestionError: errorMsg,
        },
      });

      return NextResponse.json({
        id: document.id,
        projectId: document.projectId,
        vendorName: document.vendorName,
        fileName: document.fileName,
        fileType: document.fileType,
        documentType: document.documentType,
        quoteVersion: document.quoteVersion,
        isActive: document.isActive,
        ingestionStatus: 'failed',
        ingestionError: errorMsg,
        extractionWarning,
        uploadedAt: document.uploadedAt,
      }, { status: 201 });
    }
  } else {
    // Pasted text — already parsed
    await prisma.document.update({
      where: { id: document.id },
      data: { rawText, ingestionStatus: 'parsed' },
    });
  }

  return NextResponse.json({
    id: document.id,
    projectId: document.projectId,
    vendorName: document.vendorName,
    fileName: document.fileName,
    fileType: document.fileType,
    fileSize: document.fileSize,
    documentType: document.documentType,
    quoteVersion: document.quoteVersion,
    isActive: document.isActive,
    ingestionStatus: 'parsed',
    extractionWarning,
    uploadedAt: document.uploadedAt,
  }, { status: 201 });
}
