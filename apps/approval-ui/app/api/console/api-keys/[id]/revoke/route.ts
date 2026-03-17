import {
  getConsoleProxyOrganization,
  getRequiredDashboardSession,
  proxyAuthonJson,
  requireDashboardSession,
} from '@/lib/dashboard-auth/proxy';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const { id } = await context.params;

  return proxyAuthonJson(
    `/v1/api-keys/${id}/revoke`,
    {
      method: 'POST',
    },
    getConsoleProxyOrganization(session),
  );
}
