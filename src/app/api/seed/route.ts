import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({ message: 'Database already seeded' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash('outsail2024', 12);

    await prisma.user.create({
      data: {
        email: 'brett@outsail.co',
        passwordHash,
        name: 'Brett Ungashick',
        role: 'advisor',
      },
    });

    return NextResponse.json({ message: 'Seed complete: brett@outsail.co created' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
