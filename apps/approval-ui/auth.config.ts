import type { NextAuthConfig } from 'next-auth';
import { ensureDashboardUserOrganizationContext } from '@/lib/dashboard-auth/organization';
import { isOpenCoreRuntimeMode } from '@/lib/runtime-mode';

const PROTECTED_PREFIXES = ['/console', '/settings', '/account', '/org'];

const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
    verifyRequest: '/verify-request',
  },
  callbacks: {
    async signIn() {
      if (isOpenCoreRuntimeMode()) {
        return true;
      }

      return true;
    },
    authorized({ auth, request: { nextUrl } }) {
      const requiresDashboardAuth = PROTECTED_PREFIXES.some((prefix) =>
        nextUrl.pathname.startsWith(prefix),
      );

      if (!requiresDashboardAuth) {
        return true;
      }

      if (isOpenCoreRuntimeMode()) {
        return true;
      }

      return Boolean(auth?.user);
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.sub = (user as { id?: string }).id ?? token.sub;
      }

      if (account?.provider) {
        token.provider = account.provider;
      }

      if (typeof token.sub === 'string') {
        const organizationContext = await ensureDashboardUserOrganizationContext(token.sub);

        token.organizationMemberships = organizationContext?.memberships ?? [];
        token.activeOrganization = organizationContext?.activeOrganization ?? null;
        token.needsOnboarding = organizationContext?.needsOnboarding ?? false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.sub === 'string') {
          session.user.id = token.sub;
        }

        if (typeof token.name === 'string') {
          session.user.name = token.name;
        }

        if (typeof token.email === 'string') {
          session.user.email = token.email;
        }

        if (typeof token.picture === 'string') {
          session.user.image = token.picture;
        }
      }

      session.activeOrganization =
        (token.activeOrganization as typeof session.activeOrganization | undefined) ?? null;
      session.organizationMemberships =
        (token.organizationMemberships as typeof session.organizationMemberships | undefined) ??
        [];
      session.needsOnboarding = Boolean(token.needsOnboarding);

      return session;
    },
  },
};

export default authConfig;
