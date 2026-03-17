import { NextResponse } from 'next/server';
import {
  getConsoleProxyOrganization,
  getRequiredDashboardSession,
  proxyAuthonJson,
  requireDashboardSession,
} from '@/lib/dashboard-auth/proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();

  return proxyAuthonJson(
    '/v1/integrations',
    {
      method: 'GET',
    },
    getConsoleProxyOrganization(session),
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireDashboardSession();

  if (unauthorized) {
    return unauthorized;
  }

  const session = await getRequiredDashboardSession();
  const body = await request.text();

  return proxyAuthonJson(
    '/v1/integrations',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    },
    getConsoleProxyOrganization(session),
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Use /api/console/integrations/:id for integration updates.',
      },
    },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Use /api/console/integrations/:id for integration deletion.',
      },
    },
    { status: 405 },
  );
}
