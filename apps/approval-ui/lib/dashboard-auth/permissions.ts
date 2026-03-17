import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import type { OrganizationMemberRole, OrganizationPermission } from '@approva/shared';
import { hasOrganizationPermission } from '@approva/shared';
import { auth } from '@/auth';
import { isOpenCoreRuntimeMode } from '@/lib/runtime-mode';

export function getActiveOrganizationRole(session: Session | null) {
  if (isOpenCoreRuntimeMode()) {
    return 'owner';
  }

  if (!session?.activeOrganization?.id) {
    return null;
  }

  const membership =
    session.organizationMemberships?.find(
      (candidate: NonNullable<Session['organizationMemberships']>[number]) =>
        candidate.organization.id === session.activeOrganization?.id,
    ) ?? null;

  return membership?.role ?? null;
}

export async function getDashboardPermissionContext() {
  if (isOpenCoreRuntimeMode()) {
    return {
      session: null,
      activeRole: 'owner' as const,
      can(_permission: OrganizationPermission) {
        return true;
      },
    };
  }

  const session = await auth();
  const activeRole = getActiveOrganizationRole(session);

  return {
    session,
    activeRole,
    can(permission: OrganizationPermission) {
      return hasOrganizationPermission(activeRole, permission);
    },
  };
}

export async function requireDashboardPermission(permission: OrganizationPermission) {
  const context = await getDashboardPermissionContext();

  if (isOpenCoreRuntimeMode()) {
    return {
      session: null,
      activeRole: 'owner' as const,
      can(_candidate: OrganizationPermission) {
        return true;
      },
    };
  }

  if (!context.session?.user) {
    redirect('/sign-in?callbackUrl=/console/approvals');
  }

  if (!context.can(permission)) {
    redirect('/console/approvals?denied=1');
  }

  return context as {
    session: NonNullable<Session>;
    activeRole: OrganizationMemberRole;
    can(permission: OrganizationPermission): boolean;
  };
}
