import {
  getConsoleProxyOrganization,
  getRequiredDashboardSession,
  proxyAuthonJson,
  requireDashboardSession,
} from '@/lib/dashboard-auth/proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const body = await request.text();

  return proxyAuthonJson('/v1/internal/ledger/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body,
  }, getConsoleProxyOrganization(session));
}
