import { ConsoleServiceAccountsPage } from '@/components/console/console-service-accounts-page';
import { getDashboardPermissionContext } from '@/lib/dashboard-auth/permissions';

export default async function ConsoleServiceAccountsRoute() {
  const context = await getDashboardPermissionContext();

  return (
    <ConsoleServiceAccountsPage
      activeRole={context.activeRole}
      canManageServiceAccounts={context.can('service_accounts:manage')}
    />
  );
}
