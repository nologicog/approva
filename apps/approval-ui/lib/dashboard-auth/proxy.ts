import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isOpenCoreRuntimeMode } from '@/lib/runtime-mode';

const apiBaseUrl = (
  process.env.AUTHON_INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

export async function requireDashboardSession() {
  if (isOpenCoreRuntimeMode()) {
    return null;
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      {
        error: {
          code: 'DASHBOARD_AUTH_REQUIRED',
          message: 'Dashboard authentication is required.',
        },
      },
      { status: 401 },
    );
  }

  if (!session.activeOrganization?.id) {
    return NextResponse.json(
      {
        error: {
          code: 'ACTIVE_ORGANIZATION_REQUIRED',
          message: 'An active organization is required for dashboard console access.',
        },
      },
      { status: 403 },
    );
  }

  return null;
}

export async function getRequiredDashboardSession() {
  if (isOpenCoreRuntimeMode()) {
    return null;
  }

  const session = await auth();

  if (!session?.user || !session.activeOrganization?.id) {
    return null;
  }

  return session;
}

export function getAuthonApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export function getConsoleProxyOrganization(
  session: Session | null | undefined,
) {
  if (isOpenCoreRuntimeMode()) {
    return undefined;
  }

  if (!session?.activeOrganization?.id) {
    return undefined;
  }

  return {
    id: session.activeOrganization.id,
    slug: session.activeOrganization.slug,
  };
}

export async function proxyAuthonJson(
  path: string,
  init?: RequestInit,
  organization?: {
    id: string;
    slug?: string | null;
  },
) {
  const session = isOpenCoreRuntimeMode() ? null : await auth();

  const response = await fetch(getAuthonApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(organization?.id
        ? {
            'x-authon-organization-id': organization.id,
          }
        : {}),
      ...(organization?.slug
        ? {
            'x-authon-organization-slug': organization.slug,
          }
        : {}),
      ...(!isOpenCoreRuntimeMode() && session?.user?.id
        ? {
            'x-authon-dashboard-user-id': session.user.id,
          }
        : {}),
      ...(!isOpenCoreRuntimeMode() && session?.user?.email
        ? {
            'x-authon-dashboard-user-email': session.user.email,
          }
        : {}),
      ...(!isOpenCoreRuntimeMode() && session?.user?.name
        ? {
            'x-authon-dashboard-user-name': session.user.name,
          }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
