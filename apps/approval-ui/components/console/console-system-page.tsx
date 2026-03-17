'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  AuthonRuntimeMode,
  InternalApprovalRequestListResponse,
  Organization,
  OrganizationMemberRole,
  OrganizationMembership,
} from '@approva/shared';
import { listConsoleApprovalRequests } from '@/lib/console-api';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const sampleApproverEmail =
  process.env.NEXT_PUBLIC_SAMPLE_APPROVER_EMAIL ?? 'approver@example.com';
const releaseLabel =
  process.env.NEXT_PUBLIC_APPROVA_RELEASE ??
  process.env.NEXT_PUBLIC_AUTHON_RELEASE ??
  'Open Core · 2026.03';

interface DashboardIdentity {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function ConsoleSystemPage({
  runtimeMode,
  activeRole,
  canManagePolicies,
  canManageIntegrations,
  canVerifyLedger,
  dashboardIdentity,
  activeOrganization,
  organizationMemberships,
}: {
  runtimeMode: AuthonRuntimeMode;
  activeRole: OrganizationMemberRole | null;
  canManagePolicies: boolean;
  canManageIntegrations: boolean;
  canVerifyLedger: boolean;
  dashboardIdentity: DashboardIdentity | null;
  activeOrganization: Organization | null;
  organizationMemberships: OrganizationMembership[];
}) {
  const openCoreMode = runtimeMode === 'open-core';
  const [approvalsSnapshot, setApprovalsSnapshot] =
    useState<InternalApprovalRequestListResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await listConsoleApprovalRequests();

        if (!cancelled) {
          setApprovalsSnapshot(response);
          setApiError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setApiError(
            loadError instanceof Error ? loadError.message : 'API is not reachable.',
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="console-stack">
      <section className="console-section-grid">
        <article className="card stack">
          <div className="console-section-header">
            <div>
              <div className="label">Getting started</div>
              <h2>First-run checklist</h2>
            </div>
            <span className="eyebrow">
              {openCoreMode ? 'Open Core' : 'Authenticated'}
            </span>
          </div>

          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>Step 1</span>
              <strong>
                {openCoreMode
                  ? 'Open the approvals inbox directly and create a test approval through the demo or API.'
                  : activeOrganization
                    ? `You are operating inside ${activeOrganization.name}.`
                    : 'Sign in with a user that already belongs to an organization.'}
              </strong>
            </div>
            <div className="console-detail-item">
              <span>Step 2</span>
              <strong>
                Create at least one policy so high-risk actions route to the right approver roles.
              </strong>
            </div>
            <div className="console-detail-item">
              <span>Step 3</span>
              <strong>
                Add integrations only if you need notifications. Approva can still run with env
                fallbacks during setup.
              </strong>
            </div>
          </div>

          <div className="console-link-grid">
            <Link className="button ghost link-button" href="/help">
              Open help hub
            </Link>
            <Link className="button ghost link-button" href="/help#api-quickstart">
              API quickstart
            </Link>
            <Link className="button ghost link-button" href="/help#self-host">
              Self-host guide
            </Link>
          </div>

          {!openCoreMode && !activeOrganization ? (
            <div className="notice warning">
              <strong>No active organization</strong>
              <div>
                Dashboard auth is working, but the console needs an active organization before it
                can load tenant-scoped data. Sign in with a user that is already attached to an
                organization.
              </div>
            </div>
          ) : null}
        </article>

        <article className="card stack">
          <div>
            <div className="label">System status</div>
            <h2>Local operator snapshot</h2>
          </div>

          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>API reachable</span>
              <strong>{apiError ? 'No' : 'Yes'}</strong>
            </div>
            <div className="console-detail-item">
              <span>API base URL</span>
              <strong className="mono-wrap">{apiBaseUrl}</strong>
            </div>
            <div className="console-detail-item">
              <span>Known approvals</span>
              <strong>{approvalsSnapshot?.total ?? 0}</strong>
            </div>
            <div className="console-detail-item">
              <span>Runtime mode</span>
              <strong>{runtimeMode}</strong>
            </div>
            <div className="console-detail-item">
              <span>Release marker</span>
              <strong>{releaseLabel}</strong>
            </div>
            <div className="console-detail-item">
              <span>Dashboard auth</span>
              <strong>
                {openCoreMode
                  ? 'Optional in open-core mode'
                  : dashboardIdentity?.email
                    ? 'Authenticated'
                    : 'Not authenticated'}
              </strong>
            </div>
            <div className="console-detail-item">
              <span>Active organization</span>
              <strong>{activeOrganization?.name ?? 'No active organization'}</strong>
            </div>
            <div className="console-detail-item">
              <span>Active role</span>
              <strong>{activeRole ?? 'No active role'}</strong>
            </div>
          </div>

          {apiError ? <div className="error">{apiError}</div> : null}
        </article>

        <article className="card stack">
          <div>
            <div className="label">Operational links</div>
            <h2>Health and telemetry</h2>
          </div>

          <div className="console-link-grid">
            <a
              className="button ghost link-button"
              href={`${apiBaseUrl}/health/live`}
              rel="noreferrer"
              target="_blank"
            >
              /health/live
            </a>
            <a
              className="button ghost link-button"
              href={`${apiBaseUrl}/health/ready`}
              rel="noreferrer"
              target="_blank"
            >
              /health/ready
            </a>
            <a
              className="button ghost link-button"
              href={`${apiBaseUrl}/v1/internal/metrics`}
              rel="noreferrer"
              target="_blank"
            >
              Metrics
            </a>
            <Link className="button ghost link-button" href="/help">
              Help hub
            </Link>
          </div>

          <div className="empty">
            Use these links first after deploys or incidents. Ready should stay green, metrics
            should continue moving, and any API-level failure should have a request id in logs.
          </div>
        </article>

        <article className="card stack">
          <div>
            <div className="label">Current session</div>
            <h2>Approver identity</h2>
          </div>

          <div className="session-summary">
            <div className="session-line">
              <strong>Status</strong>
              <span
                className={`status ${
                  openCoreMode || dashboardIdentity?.email ? 'approved' : 'expired'
                }`}
              >
                {openCoreMode
                  ? 'open-core mode'
                  : dashboardIdentity?.email
                    ? 'authenticated'
                    : 'not authenticated'}
              </span>
            </div>
            <div className="session-line">
              <strong>Dashboard identity</strong>
              <span>
                {dashboardIdentity?.email ??
                  (openCoreMode
                    ? 'Not required in open-core mode'
                    : 'No active dashboard session')}
              </span>
            </div>
            <div className="session-line">
              <strong>Display name</strong>
              <span>{dashboardIdentity?.name ?? (openCoreMode ? 'Open-core operator' : 'Not available')}</span>
            </div>
            <div className="session-line">
              <strong>Auth domain</strong>
              <span>
                {openCoreMode ? 'Default org operator console' : 'Dashboard / console only'}
              </span>
            </div>
            <div className="session-line">
              <strong>Active org</strong>
              <span>{activeOrganization?.slug ?? 'Not selected'}</span>
            </div>
            <div className="session-line">
              <strong>Memberships</strong>
              <span>{organizationMemberships.length}</span>
            </div>
          </div>

          <div className="empty">
            {openCoreMode
              ? 'Approval decisions still require the secure approval link plus a separate passkey approver session. Open-core mode only changes dashboard console access and default-org behavior.'
              : 'Approval decisions still require the existing secure approval link plus a separate passkey approver session. Dashboard auth does not replace approval auth.'}
          </div>
        </article>

        <article className="card stack">
          <div>
            <div className="label">Week-one ops</div>
            <h2>What to watch</h2>
          </div>

          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>Day 0</span>
              <strong>Health/readiness, first approval creation, first passkey approval, first webhook, first capability exchange.</strong>
            </div>
            <div className="console-detail-item">
              <span>Day 1</span>
              <strong>Auth failures, webhook failures, email failures, and passkey-registration issues.</strong>
            </div>
            <div className="console-detail-item">
              <span>Week 1</span>
              <strong>Approval volume, approval denials, exchange-token failures, Slack failures, unusual rate-limit spikes.</strong>
            </div>
          </div>

          <div className="console-link-grid">
            <Link className="button ghost link-button" href="/help">
              Help hub
            </Link>
            <Link className="button ghost link-button" href="/console/approvals">
              Approvals inbox
            </Link>
          </div>

          <div className="empty">
            Use the self-host and monitoring docs in this repository as the shared reference for
            day 0, day 1, and week 1 decisions.
          </div>
        </article>

        <article className="card stack">
          <div>
            <div className="label">Quick links</div>
            <h2>Useful local routes</h2>
          </div>

          <div className="console-link-grid">
            <Link className="button ghost link-button" href="/console/approvals">
              Approvals inbox
            </Link>
            <Link className="button ghost link-button" href="/help">
              Help hub
            </Link>
            {canVerifyLedger ? (
              <Link className="button ghost link-button" href="/console/ledger">
                Ledger verifier
              </Link>
            ) : null}
            {canManagePolicies ? (
              <Link className="button ghost link-button" href="/console/policies">
                Policies
              </Link>
            ) : null}
            {canManageIntegrations ? (
              <Link className="button ghost link-button" href="/console/integrations">
                Integrations
              </Link>
            ) : null}
            <Link className="button ghost link-button" href="/demo/ai-deploy">
              AI deploy demo
            </Link>
            <a
              className="button ghost link-button"
              href={`${apiBaseUrl}/docs`}
              rel="noreferrer"
              target="_blank"
            >
              Swagger docs
            </a>
          </div>
        </article>

        <article className="card stack">
          <div>
            <div className="label">Seeded local demo data</div>
            <h2>Approver and notes</h2>
          </div>

          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>Seeded approver</span>
              <strong>Jordan Vale</strong>
            </div>
            <div className="console-detail-item">
              <span>Seeded email</span>
              <strong>{sampleApproverEmail}</strong>
            </div>
            <div className="console-detail-item">
              <span>Passkey note</span>
              <strong>Register once locally, then authenticate before secure approvals.</strong>
            </div>
            <div className="console-detail-item">
              <span>Dashboard auth</span>
              <strong>
                {openCoreMode
                  ? 'Optional in open-core mode.'
                  : 'OAuth or magic link, separate from approval passkeys.'}
              </strong>
            </div>
          </div>

          <div className="empty">
            This page is operator-facing and meant for local demos, inspection, and debugging the
            current open-core slice.
          </div>
        </article>
      </section>
    </main>
  );
}
