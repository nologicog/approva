import { ConsoleApiKeysPage } from '@/components/console/console-api-keys-page';
import { getDashboardPermissionContext } from '@/lib/dashboard-auth/permissions';

export default async function ConsoleApiKeysRoute() {
  const context = await getDashboardPermissionContext();

  return (
    <ConsoleApiKeysPage
      activeRole={context.activeRole}
      canManageApiKeys={context.can('api_keys:manage')}
      canManageServiceAccounts={context.can('service_accounts:manage')}
    />
  );
}
