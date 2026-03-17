import type { DefaultSession } from 'next-auth';
import type { Organization, OrganizationMembership } from '@approva/shared';

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string;
    };
    activeOrganization?: Organization | null;
    organizationMemberships?: OrganizationMembership[];
    needsOnboarding?: boolean;
  }

  interface User {
    id?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    provider?: string;
    activeOrganization?: Organization | null;
    organizationMemberships?: OrganizationMembership[];
    needsOnboarding?: boolean;
  }
}
