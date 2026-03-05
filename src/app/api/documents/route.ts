import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireProjectAccess } from '@/lib/access';
import { extractTextFromBuffer, getFileType } from '@/lib/file-parser';

// Configurable via env, default 15MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '15', 10) * 1024 * 1024;

// One-time migration: ensure new columns exist in Turso
let _migrated = false;
async function ensureDocumentColumns() {
  if (_migrated) return;
  const addCol = async (col: string, def: string) => {
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Document" ADD COLUMN "${col}" ${def}`); } catch { /* exists */ }
  };
  await addCol('fileSize', 'INTEGER');
  await addCol('ingestionStatus', "TEXT NOT NULL DEFAULT 'uploaded'");
  await addCol('ingestionError', 'TEXT');
  _migrated = true;
}

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
  await ensureDocumentColumns();

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const hasAccess = await requireProjectAccess(projectId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let fileSize: number | null = null;
  let rawText = '';
  let fileType = 'text';
  let resolvedFileName = fileName;

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

  // Determine version
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
      where: { projectId, vendorName, documentType: 'initial_quote' },
      data: { isActive: false },
    });

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

      await prisma.document.update({
        where: { id: document.id },
        data: { rawText, ingestionStatus: 'parsed' },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      console.error('Text extraction error:', error);

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
    uploadedAt: document.uploadedAt,
  }, { status: 201 });
}
