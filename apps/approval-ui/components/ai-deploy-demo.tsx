'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ApprovalRequestResponse,
  DemoTimelineEntry,
  DemoTimelineResponse,
} from '@approva/shared';
import { getApprovalClient } from '@/lib/api';
import {
  cleanupExpiredDemoCapabilityTokens,
  clearDemoCapabilityToken,
  getDemoCapabilityBridgeTtlMinutes,
  type DemoCapabilityBridgeState,
  readDemoCapabilityToken,
} from '@/lib/demo-capability-bridge';
import { useAuth } from './auth-provider';

const DEMO_DEPLOYMENT = {
  target: 'billing-api',
  environment: 'production',
  version: '2026.03.16-demo',
  region: 'eu-west-1',
  action: 'deployment.execute',
  resource: {
    type: 'service',
    id: 'billing-api',
  },
  requestedBy: {
    system: 'ai-deploy-agent',
    actorId: 'billing-api-demo-runner',
  },
  riskLevel: 'high' as const,
};

const TIMELINE_STEPS: Array<{
  eventType: DemoTimelineEntry['eventType'];
  label: string;
  description: string;
}> = [
  {
    eventType: 'approval_request.created',
    label: 'Request created',
    description: 'The AI deploy agent asked Approva for permission to execute a production deployment.',
  },
  {
    eventType: 'approval_request.pending',
    label: 'Approval required',
    description: 'Approva paused the deployment because the action is high risk.',
  },
  {
    eventType: 'approval_request.approved',
    label: 'Approved with passkey',
    description: 'A human approver authenticated with a passkey and approved the deployment.',
  },
  {
    eventType: 'capability.issued',
    label: 'Capability issued',
    description: 'Approva minted a scoped opaque capability token for this deployment action.',
  },
  {
    eventType: 'capability.used',
    label: 'Capability used',
    description: 'The AI deploy agent presented the capability before deployment execution.',
  },
  {
    eventType: 'deployment.executed',
    label: 'Deployment executed',
    description: 'The demo deployment was recorded as successfully executed in production.',
  },
];

function formatTimestamp(value?: string | null) {
  if (!value) {
    return 'Waiting...';
  }

  return new Date(value).toLocaleString();
}

function getTimelineActorLabel(entry: DemoTimelineEntry) {
  if (entry.eventType === 'approval_request.approved') {
    const authContext = entry.payload.authContext as Record<string, unknown> | undefined;
    const approverEmail =
      typeof authContext?.approverEmail === 'string' ? authContext.approverEmail : null;

    if (approverEmail) {
      return `Human approver • ${approverEmail}`;
    }
  }

  if (entry.actorType && entry.actorId) {
    return `${entry.actorType} • ${entry.actorId}`;
  }

  if (entry.actorId) {
    return entry.actorId;
  }

  return null;
}

function getDemoNextStep(
  requestStatus: ApprovalRequestResponse['request']['status'] | null,
  hasCapabilityToken: boolean,
  bridgeState: DemoCapabilityBridgeState,
  deploymentExecuted: boolean,
) {
  if (!requestStatus) {
    return {
      tone: 'info' as const,
      title: 'No demo run yet',
      body: 'Start by requesting deployment approval for billing-api production.',
    };
  }

  if (deploymentExecuted) {
    return {
      tone: 'success' as const,
      title: 'Demo completed',
      body: 'The approval flow, capability use, and deployment execution have all been recorded.',
    };
  }

  if (requestStatus === 'pending') {
    return {
      tone: 'info' as const,
      title: 'Next step: approve with passkey',
      body: 'Open the secure approval page, authenticate with a passkey, and approve the request.',
    };
  }

  if (requestStatus === 'approved' || requestStatus === 'auto_approved') {
    if (hasCapabilityToken) {
      return {
        tone: 'success' as const,
        title: 'Next step: run the deploy agent',
        body: 'The capability token is available in this browser. Use it to execute the deployment.',
      };
    }

    if (bridgeState.expired) {
      return {
        tone: 'warning' as const,
        title: 'Demo token bridge expired',
        body: `The demo-only bridged capability token expired after ${getDemoCapabilityBridgeTtlMinutes()} minutes. Create a fresh demo run and approve it in this browser to continue.`,
      };
    }

    return {
      tone: 'warning' as const,
      title: 'Capability token missing',
      body: 'Approval is complete, but the demo-only bridged capability token is not present in this browser. Complete approval in this same browser session or create a fresh demo run.',
    };
  }

  if (requestStatus === 'rejected') {
    return {
      tone: 'warning' as const,
      title: 'Request rejected',
      body: 'This deployment will not proceed. Create a fresh demo run if you want to try the flow again.',
    };
  }

  return {
    tone: 'warning' as const,
    title: 'Request expired',
    body: 'This approval request expired before a decision was recorded. Create a fresh demo run to continue.',
  };
}

export function AiDeployDemo() {
  const auth = useAuth();
  const [approvalResult, setApprovalResult] = useState<ApprovalRequestResponse | null>(null);
  const [secureApprovalUrl, setSecureApprovalUrl] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<DemoTimelineResponse | null>(null);
  const [bridgeState, setBridgeState] = useState<DemoCapabilityBridgeState>({
    token: null,
    storedAt: null,
    expiresAt: null,
    expired: false,
  });
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [agentMessage, setAgentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const requestId = approvalResult?.request.id ?? null;
  const approvalUrl = secureApprovalUrl;
  const requestStatus = approvalResult?.request.status ?? null;
  const issuedCapability = approvalResult?.request.capability ?? approvalResult?.capability ?? null;
  const capabilityToken = bridgeState.token;

  useEffect(() => {
    cleanupExpiredDemoCapabilityTokens();
  }, []);

  useEffect(() => {
    if (!requestId) {
      setBridgeState({
        token: null,
        storedAt: null,
        expiresAt: null,
        expired: false,
      });
      return;
    }

    const syncBridgeState = () => {
      setBridgeState(readDemoCapabilityToken(requestId));
    };

    syncBridgeState();

    const handleStorage = () => {
      syncBridgeState();
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setTimeline(null);
      setLastRefreshedAt(null);
      return;
    }

    let cancelled = false;

    const sync = async (showRefreshing = false) => {
      if (showRefreshing) {
        setRefreshing(true);
      }

      try {
        const [nextApprovalResult, nextTimeline] = await Promise.all([
          getApprovalClient().getApprovalRequest(requestId),
          getApprovalClient().getAiDeployTimeline(requestId),
        ]);

        if (cancelled) {
          return;
        }

        setApprovalResult(nextApprovalResult);
        setTimeline(nextTimeline);
        setBridgeState(readDemoCapabilityToken(requestId));
        setLastRefreshedAt(new Date().toISOString());
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : 'Failed to refresh the demo state.',
          );
        }
      } finally {
        if (!cancelled && showRefreshing) {
          setRefreshing(false);
        }
      }
    };

    void sync();

    const interval = window.setInterval(() => {
      void sync();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [requestId]);

  const handleRequestApproval = async () => {
    setRequesting(true);
    setError(null);
    setAgentMessage(null);

    try {
      const dedupeKey = `ai-deploy-demo-${Date.now()}`;
      const created = await getApprovalClient().requestApproval(
        {
          externalRequestId: dedupeKey,
          requestedBy: DEMO_DEPLOYMENT.requestedBy,
          action: DEMO_DEPLOYMENT.action,
          riskLevel: DEMO_DEPLOYMENT.riskLevel,
          resource: DEMO_DEPLOYMENT.resource,
          params: {
            environment: DEMO_DEPLOYMENT.environment,
            version: DEMO_DEPLOYMENT.version,
            region: DEMO_DEPLOYMENT.region,
          },
        },
        {
          idempotencyKey: dedupeKey,
        },
      );

      setApprovalResult(created);
      setSecureApprovalUrl(created.approvalUrl ?? null);
      setTimeline(null);
      setBridgeState({
        token: null,
        storedAt: null,
        expiresAt: null,
        expired: false,
      });
      setAgentMessage(
        'Approval request created. Open the secure approval page in a second tab, authenticate with a passkey, and approve the deployment.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to request deployment approval.',
      );
    } finally {
      setRequesting(false);
    }
  };

  const handleRunDeployAgent = async () => {
    if (!requestId || !capabilityToken) {
      return;
    }

    setRunningAgent(true);
    setError(null);
    setAgentMessage(null);

    try {
      const useResult = await getApprovalClient().useCapability({
        token: capabilityToken,
        action: DEMO_DEPLOYMENT.action,
        resource: DEMO_DEPLOYMENT.resource,
        params: {
          environment: DEMO_DEPLOYMENT.environment,
          version: DEMO_DEPLOYMENT.version,
          region: DEMO_DEPLOYMENT.region,
        },
      });

      if (!useResult.valid) {
        throw new Error(
          useResult.invalidReason?.message ?? useResult.reason ?? 'Capability was rejected.',
        );
      }

      clearDemoCapabilityToken(requestId);
      setBridgeState({
        token: null,
        storedAt: null,
        expiresAt: null,
        expired: false,
      });

      await getApprovalClient().executeAiDeployment(requestId);

      const [nextApprovalResult, nextTimeline] = await Promise.all([
        getApprovalClient().getApprovalRequest(requestId),
        getApprovalClient().getAiDeployTimeline(requestId),
      ]);

      setApprovalResult(nextApprovalResult);
      setTimeline(nextTimeline);
      setLastRefreshedAt(new Date().toISOString());
      setAgentMessage(
        'Capability accepted. The AI deploy agent executed the production deployment and the event chain has been updated.',
      );
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : 'Failed to run the deploy agent.',
      );
    } finally {
      setRunningAgent(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);

    try {
      await auth.logout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Failed to clear session.');
    } finally {
      setLoggingOut(false);
    }
  };

  const timelineByType = new Map(
    timeline?.timeline.map((entry) => [entry.eventType, entry]) ?? [],
  );
  const sessionStatus = auth.sessionLoading
    ? 'checking'
    : auth.session?.authenticated
      ? 'authenticated'
      : 'not authenticated';
  const nextStep = useMemo(
    () =>
      getDemoNextStep(
        requestStatus,
        Boolean(capabilityToken),
        bridgeState,
        timeline?.deploymentExecuted ?? false,
      ),
    [bridgeState, capabilityToken, requestStatus, timeline?.deploymentExecuted],
  );
  const canRunDeployAgent =
    Boolean(requestId) &&
    Boolean(capabilityToken) &&
    (requestStatus === 'approved' || requestStatus === 'auto_approved') &&
    !timeline?.deploymentExecuted;

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">AI Deploy Approval Demo</span>
        <h1>Show the full Approva loop from risky agent action to scoped execution.</h1>
        <p>
          This page simulates an AI deploy agent requesting approval for a production
          deployment, waiting for a human passkey-authenticated decision, receiving a
          scoped capability, and using it before execution is recorded in the event chain.
        </p>
      </section>

      <section className="grid two demo-grid">
        <article className="card stack">
          <div>
            <div className="label">Deployment target</div>
            <h2>{DEMO_DEPLOYMENT.target}</h2>
          </div>

          <dl className="meta-grid">
            <div className="meta">
              <dt>Environment</dt>
              <dd>{DEMO_DEPLOYMENT.environment}</dd>
            </div>
            <div className="meta">
              <dt>Version</dt>
              <dd>{DEMO_DEPLOYMENT.version}</dd>
            </div>
            <div className="meta">
              <dt>Region</dt>
              <dd>{DEMO_DEPLOYMENT.region}</dd>
            </div>
            <div className="meta">
              <dt>Risk level</dt>
              <dd>
                <span className="status high">{DEMO_DEPLOYMENT.riskLevel}</span>
              </dd>
            </div>
          </dl>

          <div className="empty stack">
            <div className="label">Agent request payload</div>
            <pre className="params">{JSON.stringify(
              {
                action: DEMO_DEPLOYMENT.action,
                resource: DEMO_DEPLOYMENT.resource,
                params: {
                  environment: DEMO_DEPLOYMENT.environment,
                  version: DEMO_DEPLOYMENT.version,
                  region: DEMO_DEPLOYMENT.region,
                },
              },
              null,
              2,
            )}</pre>
          </div>

          <div className="actions">
            <button
              className="button primary"
              disabled={requesting || runningAgent}
              onClick={() => void handleRequestApproval()}
              type="button"
            >
              {requesting ? 'Requesting...' : 'Request deployment approval'}
            </button>

            {approvalUrl ? (
              <a
                className="button secondary link-button"
                href={approvalUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open approval page
              </a>
            ) : null}
          </div>

          <div className="helper">
            The demo page polls Approva every 3 seconds for request and event-chain updates.
            Approval still happens on the secure approval page.
          </div>
        </article>

        <aside className="card stack">
          <div>
            <div className="label">Demo control room</div>
            <h2>{requestId ? 'Current demo run' : 'No approval requested yet'}</h2>
          </div>

          <div className="session-summary">
            <div className="session-line">
              <span className="label">Approver session</span>
              <span
                className={`status ${
                  auth.session?.authenticated ? 'approved' : 'pending'
                }`}
              >
                {sessionStatus}
              </span>
            </div>
            {auth.session?.authenticated && auth.session.user ? (
              <div className="session-details stack">
                <div>
                  Approver <span className="mono">{auth.session.user.email}</span>
                </div>
                <div>
                  Session expires at{' '}
                  <span className="mono">{formatTimestamp(auth.session.expiresAt)}</span>
                </div>
                <div className="actions">
                  <button
                    className="button ghost"
                    disabled={loggingOut}
                    onClick={() => void handleLogout()}
                    type="button"
                  >
                    {loggingOut ? 'Clearing session...' : 'Logout'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="helper">
                No active approver session. That is normal until you authenticate on the approval page.
              </div>
            )}
          </div>

          <div className={`notice ${nextStep.tone}`}>
            <strong>{nextStep.title}</strong>
            <div>{nextStep.body}</div>
          </div>

          {requestId ? (
            <>
              <dl className="meta-grid">
                <div className="meta">
                  <dt>Approval request id</dt>
                  <dd className="mono mono-wrap">{requestId}</dd>
                </div>
                <div className="meta">
                  <dt>Status</dt>
                  <dd>
                    <span className={`status ${requestStatus}`}>{requestStatus}</span>
                  </dd>
                </div>
                <div className="meta">
                  <dt>Secure approval URL</dt>
                  <dd className="mono mono-wrap">{approvalUrl}</dd>
                </div>
                <div className="meta">
                  <dt>Last refresh</dt>
                  <dd>{refreshing ? 'Refreshing...' : formatTimestamp(lastRefreshedAt)}</dd>
                </div>
              </dl>

              {issuedCapability ? (
                <div className="empty stack">
                  <div className="label">Capability bridge</div>
                  <div>
                    Capability expires at{' '}
                    <span className="mono">{formatTimestamp(issuedCapability.expiresAt)}</span>
                  </div>
                  <div>
                    Demo token bridge state{' '}
                    <span className="mono">
                      {capabilityToken ? 'ready' : bridgeState.expired ? 'expired' : 'missing'}
                    </span>
                  </div>
                  {capabilityToken ? (
                    <>
                      <div>
                        Captured at{' '}
                        <span className="mono">{formatTimestamp(bridgeState.storedAt)}</span>
                      </div>
                      <div>
                        Bridge expires at{' '}
                        <span className="mono">{formatTimestamp(bridgeState.expiresAt)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="helper">
                      This demo-only bridge stores the raw capability token briefly in this browser
                      so the deploy agent simulation can continue. It is not part of the production architecture.
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty">
                  Capability issuance will appear here after the human approver grants the request.
                </div>
              )}

              <div className="actions">
                <button
                  className="button primary"
                  disabled={!canRunDeployAgent || runningAgent || requesting}
                  onClick={() => void handleRunDeployAgent()}
                  type="button"
                >
                  {runningAgent ? 'Running deploy agent...' : 'Use capability and execute deployment'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              Start the demo by creating a deployment approval request. Approva will return a
              secure approval URL for the human approver.
            </div>
          )}

          {agentMessage ? <div className="notice success">{agentMessage}</div> : null}
          {error ? <div className="error">{error}</div> : null}
        </aside>
      </section>

      <section className="card stack">
        <div>
          <div className="label">Event timeline</div>
          <h2>Tell the approval story in six steps</h2>
        </div>
        <div className="timeline">
          {TIMELINE_STEPS.map((step) => {
            const entry = timelineByType.get(step.eventType);
            const actorLabel = entry ? getTimelineActorLabel(entry) : null;

            return (
              <article
                className={`timeline-item ${entry ? 'done' : 'waiting'}`}
                key={step.eventType}
              >
                <div className="timeline-marker" />
                <div className="stack">
                  <div className="timeline-header">
                    <strong>{step.label}</strong>
                    <span className={`status ${entry ? 'approved' : 'pending'}`}>
                      {entry ? 'Recorded' : 'Waiting'}
                    </span>
                  </div>
                  <p>{step.description}</p>
                  <div className="timeline-story">
                    {entry ? formatTimestamp(entry.createdAt) : 'Waiting for this step'}
                    {actorLabel ? ` • ${actorLabel}` : ''}
                  </div>
                  {entry ? (
                    <details className="timeline-details">
                      <summary>Technical details</summary>
                      <div className="timeline-meta mono">
                        event={entry.eventType} | ledger={entry.ledgerSequence ?? 'n/a'} | hash=
                        {entry.ledgerEntryHash ?? 'n/a'}
                      </div>
                      <div className="timeline-meta mono">payload_hash={entry.payloadHash ?? 'n/a'}</div>
                      <pre className="params timeline-payload">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
