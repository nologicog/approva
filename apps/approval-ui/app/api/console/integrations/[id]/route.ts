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

export async function PUT(request: Request, context: RouteContext) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const { id } = await context.params;
  const body = await request.text();

  return proxyAuthonJson(
    `/v1/integrations/${id}`,
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body,
    },
    getConsoleProxyOrganization(session),
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const { id } = await context.params;

  return proxyAuthonJson(
    `/v1/integrations/${id}`,
    {
      method: 'DELETE',
    },
    getConsoleProxyOrganization(session),
  );
}
