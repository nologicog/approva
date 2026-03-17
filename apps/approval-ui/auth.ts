import NextAuth, { type NextAuthResult } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getOpenCoreDashboardAuthSecret } from '@approva/config';
import authConfig from '@/auth.config';
import { prisma } from '@/lib/dashboard-auth/prisma';
import { buildDashboardAuthProviders } from '@/lib/dashboard-auth/providers';
import {
  getDashboardAuthCookieName,
  isDashboardAuthSecure,
} from '@/lib/security';

const dashboardAuthSecure = isDashboardAuthSecure(process.env);

const nextAuth = NextAuth({
  ...authConfig,
  secret: getOpenCoreDashboardAuthSecret(process.env),
  adapter: PrismaAdapter(prisma),
  providers: buildDashboardAuthProviders(),
  useSecureCookies: dashboardAuthSecure,
  cookies: {
    sessionToken: {
      name: getDashboardAuthCookieName(process.env),
      options: {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: dashboardAuthSecure,
      },
    },
  },
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
