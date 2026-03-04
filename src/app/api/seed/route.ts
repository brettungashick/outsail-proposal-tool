import { NextResponse } from 'next/server';

/**
 * Seed route is disabled in production. Use the CLI seeding mechanism instead:
 *   npm run db:seed
 *
 * This route always returns 404 in production, regardless of ALLOW_SEED.
 * In non-production, it requires ALLOW_SEED=true AND an authenticated admin session.
 */
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
