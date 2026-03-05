import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { checkRateLimit, recordFailedLogin, clearFailedLogins, isAccountLocked } from './rate-limit';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        // Rate limit: 5 login attempts per email per 15 minutes
        const rl = checkRateLimit({ key: `login:${email}`, limit: 5, windowMs: 15 * 60 * 1000 });
        if (!rl.success) return null;

        // Account lockout check
        if (isAccountLocked(`lockout:${email}`)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          recordFailedLogin(`lockout:${email}`);
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          recordFailedLogin(`lockout:${email}`);
          return null;
        }

        clearFailedLogins(`lockout:${email}`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
