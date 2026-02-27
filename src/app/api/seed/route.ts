import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // Create tables if they don't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'advisor',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Project" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "clientName" TEXT NOT NULL,
        "clientEmail" TEXT,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "advisorId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Project_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Document" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "vendorName" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileType" TEXT NOT NULL,
        "rawText" TEXT,
        "parsedData" TEXT,
        "documentType" TEXT NOT NULL DEFAULT 'initial_quote',
        "quoteVersion" INTEGER NOT NULL DEFAULT 1,
        "isActive" INTEGER NOT NULL DEFAULT 1,
        "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Add new columns to Document if they don't exist (for existing databases)
    const addColumnSafe = async (table: string, column: string, definition: string) => {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
      } catch {
        // Column already exists, ignore
      }
    };

    await addColumnSafe('Document', 'documentType', "TEXT NOT NULL DEFAULT 'initial_quote'");
    await addColumnSafe('Document', 'quoteVersion', 'INTEGER NOT NULL DEFAULT 1');
    await addColumnSafe('Document', 'isActive', 'INTEGER NOT NULL DEFAULT 1');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Analysis" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "comparisonData" TEXT NOT NULL,
        "standardizationNotes" TEXT,
        "vendorNotes" TEXT,
        "nextSteps" TEXT,
        "citations" TEXT,
        "discountToggles" TEXT,
        "createdBy" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Analysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await addColumnSafe('Analysis', 'discountToggles', 'TEXT');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AnalysisEdit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "analysisId" TEXT NOT NULL,
        "fieldPath" TEXT NOT NULL,
        "oldValue" TEXT NOT NULL,
        "newValue" TEXT NOT NULL,
        "editedBy" TEXT NOT NULL,
        "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AnalysisEdit_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ShareLink" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "expiresAt" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ShareLink_token_key" ON "ShareLink"("token")`);

    // Vendor table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Vendor" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "logoUrl" TEXT,
        "accentColor" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_name_key" ON "Vendor"("name")`);

    // --- Seed Users ---
    const passwordHash = await bcrypt.hash('outsail2024', 12);

    const users = [
      { email: 'brett@outsail.co', name: 'Brett Ungashick', role: 'admin' },
      { email: 'allen@outsail.co', name: 'Allen', role: 'advisor' },
      { email: 'jordan@outsail.co', name: 'Jordan', role: 'advisor' },
      { email: 'carl@outsail.co', name: 'Carl', role: 'advisor' },
    ];

    const createdUsers: string[] = [];
    for (const u of users) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        // Update role if needed (e.g., promote brett to admin)
        if (existing.role !== u.role) {
          await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "role" = '${u.role}' WHERE "email" = '${u.email}'`
          );
          createdUsers.push(`${u.email} (role updated to ${u.role})`);
        } else {
          createdUsers.push(`${u.email} (already exists)`);
        }
      } else {
        await prisma.user.create({
          data: { email: u.email, passwordHash, name: u.name, role: u.role },
        });
        createdUsers.push(`${u.email} (created)`);
      }
    }

    // --- Seed Vendors ---
    const defaultVendors = [
      { name: 'ADP', accentColor: '#D0271D' },
      { name: 'Paylocity', accentColor: '#0066CC' },
      { name: 'Paycom', accentColor: '#003B5C' },
      { name: 'UKG', accentColor: '#005EB8' },
      { name: 'BambooHR', accentColor: '#73C41D' },
      { name: 'Rippling', accentColor: '#FDB515' },
      { name: 'Gusto', accentColor: '#F45D48' },
      { name: 'Workday', accentColor: '#005CB9' },
      { name: 'Paychex', accentColor: '#004B87' },
      { name: 'Dayforce', accentColor: '#6B2D8B' },
      { name: 'Namely', accentColor: '#FF6B35' },
      { name: 'TriNet', accentColor: '#00A651' },
      { name: 'Justworks', accentColor: '#3D5AFE' },
      { name: 'isolved', accentColor: '#0097A9' },
      { name: 'Paycor', accentColor: '#1B365D' },
      { name: 'SAP SuccessFactors', accentColor: '#008FD3' },
      { name: 'Oracle HCM', accentColor: '#C74634' },
      { name: 'HiBob', accentColor: '#FF4F64' },
      { name: 'Factorial', accentColor: '#5D3BEE' },
      { name: 'Zenefits', accentColor: '#FF6F00' },
    ];

    let vendorsSeeded = 0;
    for (const v of defaultVendors) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO "Vendor" ("id", "name", "accentColor", "createdAt", "updatedAt") VALUES (lower(hex(randomblob(12))), '${v.name}', '${v.accentColor}', datetime('now'), datetime('now'))`
        );
        vendorsSeeded++;
      } catch {
        // Already exists
      }
    }

    return NextResponse.json({
      message: 'Seed complete',
      users: createdUsers,
      vendorsSeeded,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
