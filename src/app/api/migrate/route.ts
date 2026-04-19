import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';

// One-time migration endpoint. Admin-only. Safe to run multiple times.
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const results: { sql: string; status: string }[] = [];

  const statements = [
    // Analysis columns
    `ALTER TABLE "Analysis" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'complete'`,
    `ALTER TABLE "Analysis" ADD COLUMN "hiddenRows" TEXT`,
    `ALTER TABLE "Analysis" ADD COLUMN "parsedProposals" TEXT`,
    `ALTER TABLE "Analysis" ADD COLUMN "clarifyingQuestions" TEXT`,
    `ALTER TABLE "Analysis" ADD COLUMN "advisorAnswers" TEXT`,
    `ALTER TABLE "Analysis" ADD COLUMN "analysisProgress" TEXT`,
    // Document columns
    `ALTER TABLE "Document" ADD COLUMN "fileSize" INTEGER`,
    `ALTER TABLE "Document" ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'uploaded'`,
    `ALTER TABLE "Document" ADD COLUMN "ingestionError" TEXT`,
    // User columns
    `ALTER TABLE "User" ADD COLUMN "inviteToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "inviteStatus" TEXT NOT NULL DEFAULT 'active'`,
    `ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN "passwordResetExpires" DATETIME`,
    // ShareLink columns
    `ALTER TABLE "ShareLink" ADD COLUMN "allowedDomain" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "ShareLink" ADD COLUMN "accessMode" TEXT NOT NULL DEFAULT 'domain'`,
    // New tables
    `CREATE TABLE IF NOT EXISTS "AppSettings" (
      "id" TEXT PRIMARY KEY DEFAULT 'app',
      "logoUrl" TEXT,
      "faviconUrl" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "LearningEvent" (
      "id" TEXT PRIMARY KEY,
      "analysisId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "vendorName" TEXT NOT NULL,
      "vendorKey" TEXT,
      "rowId" TEXT NOT NULL,
      "colId" TEXT,
      "cellId" TEXT,
      "sectionName" TEXT NOT NULL,
      "vendorIndex" INTEGER NOT NULL,
      "editType" TEXT NOT NULL,
      "oldDisplay" TEXT NOT NULL,
      "oldAmount" REAL,
      "oldStatus" TEXT,
      "newDisplay" TEXT NOT NULL,
      "newAmount" REAL,
      "newStatus" TEXT,
      "rowLabel" TEXT NOT NULL,
      "reasonTag" TEXT,
      "promotedToRuleId" TEXT,
      "userId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "VendorPlaybookRule" (
      "id" TEXT PRIMARY KEY,
      "vendorName" TEXT NOT NULL,
      "vendorKey" TEXT,
      "name" TEXT NOT NULL,
      "conditionType" TEXT NOT NULL,
      "conditionValue" TEXT NOT NULL,
      "conditionField" TEXT NOT NULL,
      "actionType" TEXT NOT NULL,
      "actionValue" TEXT NOT NULL,
      "examples" TEXT,
      "confidence" TEXT NOT NULL DEFAULT 'sure',
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdBy" TEXT NOT NULL,
      "createdFromEventId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ sql: sql.slice(0, 60), status: 'ok' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // "duplicate column" means it already existed — not a real error
      if (msg.toLowerCase().includes('duplicate column') || msg.toLowerCase().includes('already exists')) {
        results.push({ sql: sql.slice(0, 60), status: 'already exists (skipped)' });
      } else {
        results.push({ sql: sql.slice(0, 60), status: `error: ${msg}` });
      }
    }
  }

  const hasErrors = results.some(r => r.status.startsWith('error'));
  return NextResponse.json({ success: !hasErrors, results }, { status: hasErrors ? 500 : 200 });
}
