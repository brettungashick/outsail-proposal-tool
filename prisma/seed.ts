import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('outsail2024', 12);

  await prisma.user.upsert({
    where: { email: 'brett@outsail.co' },
    update: {},
    create: {
      email: 'brett@outsail.co',
      passwordHash,
      name: 'Brett Ungashick',
      role: 'advisor',
    },
  });

  console.log('Seed complete: brett@outsail.co / outsail2024');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
