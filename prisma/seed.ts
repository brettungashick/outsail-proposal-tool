import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * CLI seed script — run with: npm run db:seed
 *
 * Creates tables (via Prisma push) and seeds:
 *   - Default users with random passwords (printed to console)
 *   - Default vendor registry with brand colors
 *
 * Safe to re-run: uses upsert to avoid duplicates.
 * Never deployed — only runs locally via CLI.
 */

const DEFAULT_USERS = [
  { email: 'brett@outsail.co', name: 'Brett Ungashick', role: 'admin' },
  { email: 'allen@outsail.co', name: 'Allen', role: 'advisor' },
  { email: 'jordan@outsail.co', name: 'Jordan', role: 'advisor' },
  { email: 'carl@outsail.co', name: 'Carl', role: 'advisor' },
];

const DEFAULT_VENDORS = [
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

function generatePassword(): string {
  // Use SEED_PASSWORD env var if set (for CI/automation), otherwise generate random
  const envPassword = process.env.SEED_PASSWORD;
  if (envPassword) return envPassword;
  return randomBytes(16).toString('base64url');
}

async function main() {
  console.log('Seeding database...\n');

  // --- Seed Users ---
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  console.log('--- Users ---');
  for (const u of DEFAULT_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
      },
    });
    console.log(`  ${user.email} (${u.role}) ${user.createdAt ? '' : '- created'}`);
  }

  if (!process.env.SEED_PASSWORD) {
    console.log(`\n  Generated password for all users: ${password}`);
    console.log('  Change passwords after first login!');
    console.log('  Set SEED_PASSWORD env var to use a specific password.\n');
  }

  // --- Seed Vendors ---
  console.log('--- Vendors ---');
  let vendorsCreated = 0;
  for (const v of DEFAULT_VENDORS) {
    await prisma.vendor.upsert({
      where: { name: v.name },
      update: {},
      create: { name: v.name, accentColor: v.accentColor },
    });
    vendorsCreated++;
  }
  console.log(`  ${vendorsCreated} vendors upserted\n`);

  // --- Ensure AppSettings row exists ---
  await prisma.appSettings.upsert({
    where: { id: 'app' },
    update: {},
    create: { id: 'app' },
  });
  console.log('--- AppSettings ---');
  console.log('  Default row ensured\n');

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
