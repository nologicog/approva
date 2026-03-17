import Link from 'next/link';
import type { PropsWithChildren } from 'react';
import { auth, signOut } from '@/auth';
import { ConsoleNav } from '@/components/console/console-nav';
import { switchDashboardUserOrganization } from '@/lib/dashboard-auth/organization';
import { getActiveOrganizationRole } from '@/lib/dashboard-auth/permissions';
import {
  buildOpenCoreOrganization,
  getAuthonRuntimeMode,
  isOpenCoreRuntimeMode,
} from '@/lib/runtime-mode';
import { hasOrganizationPermission } from '@approva/shared';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: PropsWithChildren) {
  const runtimeMode = getAuthonRuntimeMode();
  const openCoreMode = isOpenCoreRuntimeMode();
  const session = openCoreMode ? null : await auth();
  const identity = openCoreMode
    ? 'Default organization operator'
    : session?.user?.email ?? session?.user?.name ?? 'Authenticated operator';
  const activeOrganization = openCoreMode
    ? buildOpenCoreOrganization()
    : (session?.activeOrganization ?? null);
  const memberships = openCoreMode ? [] : (session?.organizationMemberships ?? []);
  const activeRole = openCoreMode ? 'owner' : getActiveOrganizationRole(session);
  const activeMembership =
    memberships.find((membership) => membership.organization.id === activeOrganization?.id) ??
    memberships[0] ??
    null;
  const navLinks = [
    {
      href: '/console/approvals',
      label: 'Approvals',
    },
    ...(hasOrganizationPermission(activeRole, 'policies:manage')
      ? [
          {
            href: '/console/policies',
            label: 'Policies',
          },
        ]
      : []),
    ...(hasOrganizationPermission(activeRole, 'integrations:manage')
      ? [
          {
            href: '/console/integrations',
            label: 'Integrations',
          },
        ]
      : []),
    ...(hasOrganizationPermission(activeRole, 'service_accounts:manage')
      ? [
          {
            href: '/console/service-accounts',
            label: 'Service Accounts',
          },
        ]
      : []),
    ...(hasOrganizationPermission(activeRole, 'api_keys:manage')
      ? [
          {
            href: '/console/api-keys',
            label: 'API Keys',
          },
        ]
      : []),
    ...(hasOrganizationPermission(activeRole, 'ledger:verify')
      ? [
          {
            href: '/console/ledger',
            label: 'Ledger',
          },
        ]
      : []),
    {
      href: '/help',
      label: 'Help',
    },
    {
      href: '/console/system',
      label: 'System',
    },
    {
      href: '/demo/ai-deploy',
      label: 'AI Deploy Demo',
    },
  ];

  async function dashboardSignOut() {
    'use server';

    await signOut({
      redirectTo: '/sign-in',
    });
  }

  async function switchOrganization(formData: FormData) {
    'use server';

    if (!session?.user?.id) {
      return;
    }

    const organizationId = formData.get('organizationId');

    if (typeof organizationId !== 'string' || organizationId.trim().length === 0) {
      return;
    }

    await switchDashboardUserOrganization(session.user.id, organizationId);
  }

  return (
    <div className="console-shell">
      <header className="console-topbar">
        <div className="console-brand">
          <span className="eyebrow">
            {runtimeMode === 'open-core' ? 'Approva Open Core' : 'Approva Console'}
          </span>
          <div className="console-brand-copy">
            <h1>Inspect approvals, decisions, capabilities, and the ledger chain.</h1>
            <p>
              {openCoreMode
                ? 'Single-organization operator console for self-hosted inspection, debugging, and demos.'
                : 'Authenticated operator console for approvals, policies, integrations, and machine access.'}
            </p>
          </div>
        </div>

        <div className="console-topbar-actions">
          <ConsoleNav links={navLinks} />
          <div className="console-session-badge">
            <div className="console-session-copy">
              <span className="label">Operator session</span>
              <strong>{identity}</strong>
              <span>
                {openCoreMode
                  ? 'Open-core runtime uses the default organization without dashboard login.'
                  : session?.user?.name && session.user.email
                  ? session.user.name
                  : 'Authenticated operator'}
              </span>
              <span>
                {activeOrganization
                  ? `${activeOrganization.name} · ${openCoreMode ? 'owner' : (activeMembership?.role ?? 'member')}`
                  : 'No active organization'}
              </span>
            </div>
            {memberships.length > 1 ? (
              <form action={switchOrganization} className="console-org-switcher">
                <label className="label" htmlFor="organizationId">
                  Active org
                </label>
                <select
                  defaultValue={activeOrganization?.id ?? ''}
                  id="organizationId"
                  name="organizationId"
                >
                  {memberships.map((membership) => (
                    <option key={membership.organization.id} value={membership.organization.id}>
                      {membership.organization.name} · {membership.role}
                    </option>
                  ))}
                </select>
                <button className="button ghost compact" type="submit">
                  Switch
                </button>
              </form>
            ) : null}
            {openCoreMode ? null : (
              <form action={dashboardSignOut}>
                <button className="button ghost compact" type="submit">
                  Sign out
                </button>
              </form>
            )}
          </div>
          <div className="console-links">
            <Link className="console-link" href="/">
              Approval UI
            </Link>
            <a
              className="console-link"
              href={`${apiBaseUrl}/docs`}
              rel="noreferrer"
              target="_blank"
            >
              API Docs
            </a>
          </div>
        </div>
      </header>

      <div className="console-body">{children}</div>
    </div>
  );
}
