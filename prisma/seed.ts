import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('outsail2024', 12);

  await prisma.user.upsert({
    where: { email: 'advisor@outsail.com' },
    update: {},
    create: {
      email: 'advisor@outsail.com',
      passwordHash,
      name: 'OutSail Advisor',
      role: 'advisor',
    },
  });

  console.log('Seed complete: advisor@outsail.com / outsail2024');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
