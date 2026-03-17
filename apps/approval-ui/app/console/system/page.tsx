import { auth } from '@/auth';
import { ConsoleSystemPage } from '@/components/console/console-system-page';
import { getActiveOrganizationRole } from '@/lib/dashboard-auth/permissions';
import {
  buildOpenCoreOrganization,
  getAuthonRuntimeMode,
  isOpenCoreRuntimeMode,
} from '@/lib/runtime-mode';
import { hasOrganizationPermission } from '@approva/shared';

export default async function ConsoleSystemRoute() {
  const runtimeMode = getAuthonRuntimeMode();
  const openCoreMode = isOpenCoreRuntimeMode();
  const session = openCoreMode ? null : await auth();
  const activeRole = openCoreMode ? 'owner' : getActiveOrganizationRole(session);

  return (
    <ConsoleSystemPage
      runtimeMode={runtimeMode}
      activeRole={activeRole}
      canManagePolicies={hasOrganizationPermission(activeRole, 'policies:manage')}
      canManageIntegrations={hasOrganizationPermission(activeRole, 'integrations:manage')}
      canVerifyLedger={hasOrganizationPermission(activeRole, 'ledger:verify')}
      dashboardIdentity={
        session?.user
          ? {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }
          : null
      }
      activeOrganization={openCoreMode ? buildOpenCoreOrganization() : (session?.activeOrganization ?? null)}
      organizationMemberships={openCoreMode ? [] : (session?.organizationMemberships ?? [])}
    />
  );
}
