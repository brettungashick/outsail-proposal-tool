// Runs before `next build` so a deploy never ships code that expects columns
// the production database doesn't have yet. Every statement is safe to repeat:
// columns that already exist are skipped. Local dev (no TURSO_DATABASE_URL)
// uses `npm run db:push` instead, so this is a no-op there.
import { createClient } from '@libsql/client';

const COLUMNS = [
  ['Analysis', 'pendingRevision', 'TEXT'],
  ['Analysis', 'revisionHistory', 'TEXT'],
];

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.log('[migrate] TURSO_DATABASE_URL not set, skipping database migration.');
  process.exit(0);
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

for (const [table, column, definition] of COLUMNS) {
  try {
    await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    console.log(`[migrate] Added ${table}.${column}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate column/i.test(message)) {
      console.log(`[migrate] ${table}.${column} already exists`);
      continue;
    }
    // Fail the build: deploying without the column would break every analysis page.
    console.error(`[migrate] Could not add ${table}.${column}: ${message}`);
    process.exit(1);
  }
}
