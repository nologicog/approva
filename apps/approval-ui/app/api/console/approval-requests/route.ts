import { type NextRequest, NextResponse } from 'next/server';
import {
  getConsoleProxyOrganization,
  getRequiredDashboardSession,
  proxyAuthonJson,
  requireDashboardSession,
} from '@/lib/dashboard-auth/proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const query = request.nextUrl.searchParams.toString();

  return proxyAuthonJson(
    `/v1/internal/approval-requests${query ? `?${query}` : ''}`,
    {
      method: 'GET',
    },
    getConsoleProxyOrganization(session),
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET is supported for this internal console route.',
      },
    },
    { status: 405 },
  );
}
