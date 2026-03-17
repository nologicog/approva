import { getDashboardPermissionContext } from '@/lib/dashboard-auth/permissions';
import { ConsolePoliciesPage } from '@/components/console/console-policies-page';

export default async function ConsolePoliciesRoute() {
  const context = await getDashboardPermissionContext();

  return (
    <ConsolePoliciesPage
      activeRole={context.activeRole}
      canManagePolicies={context.can('policies:manage')}
    />
  );
}
