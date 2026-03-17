import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { ApprovalClient } from '@approva/sdk';
import type {
  CapabilityUseResult,
  CreateApprovalRequestInput,
  ExchangeCapabilityResponse,
} from '@approva/shared';
import {
  verifyApprovaWebhookSignature,
  type WebhookVerificationResult,
} from './webhook-signature';

const PORT = Number(process.env.PORT ?? 4100);
const APPROVA_API_BASE_URL =
  process.env.APPROVA_API_BASE_URL ??
  process.env.AUTHON_API_BASE_URL ??
  process.env.APPROVA_BASE_URL ??
  process.env.AUTHON_BASE_URL ??
  'http://localhost:4000';
const APPROVA_API_KEY = process.env.APPROVA_API_KEY ?? process.env.AUTHON_API_KEY ?? '';
const EXAMPLE_PUBLIC_BASE_URL =
  process.env.EXAMPLE_PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;
const WEBHOOK_SIGNING_SECRET =
  process.env.WEBHOOK_SIGNING_SECRET ?? 'dev-webhook-signing-secret';

const DEPLOYMENT_REQUEST: CreateApprovalRequestInput = {
  requestedBy: {
    system: 'node-deploy-agent',
    actorId: 'billing-api-release-runner',
  },
  action: 'deployment.execute',
  riskLevel: 'high',
  resource: {
    type: 'service',
    id: 'billing-api',
  },
  params: {
    environment: 'production',
    version: '2026.03.16-demo',
    region: 'eu-west-1',
  },
};

type AgentStage =
  | 'idle'
  | 'approval_requested'
  | 'approved_waiting_for_exchange'
  | 'capability_used'
  | 'deployment_executed'
  | 'rejected'
  | 'expired'
  | 'error';

type DecisionWebhookEventType =
  | 'approval_request.approved'
  | 'approval_request.rejected'
  | 'approval_request.expired';

interface DecisionWebhookPayload {
  approvalRequestId: string;
  status: string;
  capabilityId?: string;
  capabilityExchangeToken?: string;
  capabilityExchangeExpiresAt?: string;
  [key: string]: unknown;
}

interface DecisionWebhookEnvelope {
  id: string;
  approvalRequestId: string;
  eventType: DecisionWebhookEventType;
  occurredAt: string;
  payload: DecisionWebhookPayload;
}

interface AgentEventRecord {
  id: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

interface AgentState {
  stage: AgentStage;
  approvalRequestId: string | null;
  approvalUrl: string | null;
  callbackUrl: string;
  requestStatus: string | null;
  capabilityId: string | null;
  capabilityExchangeExpiresAt: string | null;
  capabilityUseResult: CapabilityUseResult | null;
  deploymentExecutedAt: string | null;
  lastError: string | null;
  notes: string[];
  webhookEvents: AgentEventRecord[];
}

const approva = new ApprovalClient({
  baseUrl: APPROVA_API_BASE_URL,
  apiKey: APPROVA_API_KEY || undefined,
});

const callbackUrl = new URL('/webhooks/approva', EXAMPLE_PUBLIC_BASE_URL).toString();

const state: AgentState = {
  stage: 'idle',
  approvalRequestId: null,
  approvalUrl: null,
  callbackUrl,
  requestStatus: null,
  capabilityId: null,
  capabilityExchangeExpiresAt: null,
  capabilityUseResult: null,
  deploymentExecutedAt: null,
  lastError: null,
  notes: [
    'Start by creating a deployment approval request.',
  ],
  webhookEvents: [],
};

function appendNote(message: string) {
  const timestamp = new Date().toISOString();
  state.notes = [`[${timestamp}] ${message}`, ...state.notes].slice(0, 20);
  console.log(`[agent] ${message}`);
}

function publicState() {
  return {
    service: 'node-deploy-agent',
    approvaApiBaseUrl: APPROVA_API_BASE_URL,
    callbackUrl: state.callbackUrl,
    deployment: DEPLOYMENT_REQUEST,
    state: {
      stage: state.stage,
      approvalRequestId: state.approvalRequestId,
      approvalUrl: state.approvalUrl,
      requestStatus: state.requestStatus,
      capabilityId: state.capabilityId,
      capabilityExchangeExpiresAt: state.capabilityExchangeExpiresAt,
      capabilityUseResult: state.capabilityUseResult,
      deploymentExecutedAt: state.deploymentExecutedAt,
      lastError: state.lastError,
      notes: state.notes,
      webhookEvents: state.webhookEvents,
    },
    routes: {
      status: `GET ${EXAMPLE_PUBLIC_BASE_URL}/state`,
      requestApproval: `POST ${EXAMPLE_PUBLIC_BASE_URL}/request-approval`,
      webhook: `POST ${EXAMPLE_PUBLIC_BASE_URL}/webhooks/approva`,
    },
    machineAuthConfigured: Boolean(APPROVA_API_KEY),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHomePage() {
  const snapshot = publicState();
  const requestApprovalCommand = `curl -X POST ${EXAMPLE_PUBLIC_BASE_URL}/request-approval`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Approva Node Deploy Agent Example</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1416;
        --surface: #172025;
        --surface-strong: #1e2a30;
        --ink: #f4f2ea;
        --muted: #9eb0a6;
        --line: rgba(255, 255, 255, 0.08);
        --accent: #49a078;
        --warn: #db7c26;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        background: linear-gradient(160deg, #0f1416, #132228);
        color: var(--ink);
      }
      main {
        width: min(920px, calc(100vw - 28px));
        margin: 0 auto;
        padding: 32px 0 48px;
        display: grid;
        gap: 18px;
      }
      section {
        background: rgba(23, 32, 37, 0.92);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 20px;
      }
      h1, h2 { margin: 0 0 8px; }
      p { margin: 0; color: var(--muted); line-height: 1.6; }
      code, pre {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .eyebrow {
        display: inline-block;
        margin-bottom: 10px;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.8rem;
        font-weight: 700;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      button {
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
      }
      button.primary {
        background: var(--accent);
        color: #08100d;
      }
      button.secondary {
        background: rgba(255, 255, 255, 0.08);
        color: var(--ink);
      }
      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
      .helper { color: var(--muted); font-size: 0.92rem; }
      .warning {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(219, 124, 38, 0.12);
        color: #f3c38f;
      }
      pre {
        overflow: auto;
        padding: 16px;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.24);
        font-size: 0.86rem;
        line-height: 1.6;
      }
      form {
        display: grid;
        gap: 10px;
      }
      input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: var(--surface-strong);
        color: var(--ink);
        font: inherit;
      }
      a { color: #8fd6b5; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <span class="eyebrow">Approva Integration Kit</span>
        <h1>Node Deploy Agent Example</h1>
        <p>
          This example simulates a backend agent that asks Approva for approval before executing a production deployment of billing-api.
        </p>
        <div class="actions">
          <form method="post" action="/request-approval?redirect=1">
            <button class="primary" type="submit">Create approval request</button>
          </form>
          ${
            state.approvalUrl
              ? `<a href="${escapeHtml(state.approvalUrl)}" target="_blank" rel="noreferrer">Open approval URL</a>`
              : ''
          }
        </div>
        <div class="warning">
          This example uses Approva's first-party machine continuation path. On approval, the webhook carries a short-lived one-time exchange token. The agent exchanges it for the raw opaque capability token, uses the capability, and then simulates the deployment.
        </div>
      </section>

      ${
        APPROVA_API_KEY
          ? ''
          : `<section>
        <span class="eyebrow">Configuration</span>
        <p>
          Set <code>APPROVA_API_KEY</code> before using this example. <code>AUTHON_API_KEY</code> still works as a backward-compatible alias. The exchange-token continuation path requires machine authentication.
        </p>
      </section>`
      }

      <section class="grid">
        <div>
          <span class="eyebrow">Routes</span>
          <pre>${escapeHtml(JSON.stringify(snapshot.routes, null, 2))}</pre>
        </div>
        <div>
          <span class="eyebrow">Deployment</span>
          <pre>${escapeHtml(JSON.stringify(DEPLOYMENT_REQUEST, null, 2))}</pre>
        </div>
      </section>

      <section>
        <span class="eyebrow">Copy/Paste Commands</span>
        <pre>${escapeHtml(requestApprovalCommand)}</pre>
      </section>

      <section>
        <span class="eyebrow">Current State</span>
        <pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
      </section>
    </main>
  </body>
</html>`;
}

async function readRawBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(response: ServerResponse, statusCode: number, payload: string) {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
  });
  response.end(payload);
}

function redirect(response: ServerResponse, location: string) {
  response.writeHead(303, {
    location,
  });
  response.end();
}

async function createApprovalRequest() {
  const requestId = `deploy-${Date.now()}`;
  const response = await approva.requestApproval(
    {
      ...DEPLOYMENT_REQUEST,
      externalRequestId: requestId,
      callback: {
        webhookUrl: callbackUrl,
        deliverCapabilityMode: 'exchange_token',
      },
    },
    {
      idempotencyKey: requestId,
    },
  );

  state.stage = 'approval_requested';
  state.approvalRequestId = response.request.id;
  state.approvalUrl = response.approvalUrl ?? null;
  state.requestStatus = response.request.status;
  state.capabilityId = response.capability?.id ?? null;
  state.capabilityExchangeExpiresAt = null;
  state.capabilityUseResult = null;
  state.deploymentExecutedAt = null;
  state.lastError = null;
  state.webhookEvents = [];

  appendNote(
    `Created approval request ${response.request.id}. Open the approval URL to continue.`,
  );

  return response;
}

async function exchangeCapabilityAndExecute(exchangeToken: string) {
  let exchangeResult: ExchangeCapabilityResponse;

  try {
    exchangeResult = await approva.exchangeCapability({
      exchangeToken,
    });
  } catch (error) {
    state.stage = 'error';
    state.lastError =
      error instanceof Error ? error.message : 'Capability exchange failed.';
    appendNote(`Capability exchange failed: ${state.lastError}`);
    return null;
  }

  appendNote('Capability exchange completed. Using exchanged capability token.');
  return useCapabilityAndExecute(exchangeResult.capabilityToken, 'exchange');
}

async function useCapabilityAndExecute(token: string, source: 'exchange' | 'webhook') {
  const capabilityUseResult = await approva.useCapability({
    token,
    action: DEPLOYMENT_REQUEST.action,
    resource: DEPLOYMENT_REQUEST.resource,
    params: DEPLOYMENT_REQUEST.params,
  });

  state.capabilityUseResult = capabilityUseResult;

  if (!capabilityUseResult.valid) {
    state.stage = 'error';
    state.lastError = capabilityUseResult.invalidReason?.message ?? capabilityUseResult.reason ?? 'Capability use failed.';
    appendNote(`Capability use failed: ${state.lastError}`);
    return capabilityUseResult;
  }

  state.stage = 'capability_used';
  appendNote(`Capability accepted by Approva via ${source} handoff.`);

  state.stage = 'deployment_executed';
  state.deploymentExecutedAt = new Date().toISOString();
  state.lastError = null;
  appendNote('Simulated protected action: deployment executed.');

  return capabilityUseResult;
}

async function handleDecisionWebhook(event: DecisionWebhookEnvelope) {
  state.requestStatus = event.payload.status;
  state.capabilityId =
    typeof event.payload.capabilityId === 'string' ? event.payload.capabilityId : state.capabilityId;
  state.capabilityExchangeExpiresAt =
    typeof event.payload.capabilityExchangeExpiresAt === 'string'
      ? event.payload.capabilityExchangeExpiresAt
      : state.capabilityExchangeExpiresAt;
  state.webhookEvents = [
    {
      id: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      payload: event.payload,
    },
    ...state.webhookEvents,
  ].slice(0, 20);

  if (event.eventType === 'approval_request.approved') {
    const exchangeToken =
      typeof event.payload.capabilityExchangeToken === 'string'
        ? event.payload.capabilityExchangeToken
        : null;

    if (exchangeToken) {
      appendNote(
        'Approval webhook included a one-time capability exchange token. Continuing automatically.',
      );
      await exchangeCapabilityAndExecute(exchangeToken);
      return;
    }

    state.stage = 'approved_waiting_for_exchange';
    appendNote(
      'Approval webhook received, but no capability exchange token was present. Check the request callback configuration and machine-auth setup.',
    );
    return;
  }

  if (event.eventType === 'approval_request.rejected') {
    state.stage = 'rejected';
    appendNote('Approval request was rejected.');
    return;
  }

  state.stage = 'expired';
  appendNote('Approval request expired before a decision was made.');
}

function parseDecisionWebhook(rawBody: string): DecisionWebhookEnvelope {
  const parsed = JSON.parse(rawBody);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Webhook body is not a JSON object.');
  }

  const event = parsed as Record<string, unknown>;

  if (
    typeof event.id !== 'string' ||
    typeof event.approvalRequestId !== 'string' ||
    typeof event.eventType !== 'string' ||
    typeof event.occurredAt !== 'string' ||
    !event.payload ||
    typeof event.payload !== 'object' ||
    Array.isArray(event.payload)
  ) {
    throw new Error('Webhook body is missing required fields.');
  }

  return {
    id: event.id,
    approvalRequestId: event.approvalRequestId,
    eventType: event.eventType as DecisionWebhookEventType,
    occurredAt: event.occurredAt,
    payload: event.payload as DecisionWebhookPayload,
  };
}

function verificationFailure(
  response: ServerResponse,
  result: WebhookVerificationResult,
) {
  sendJson(response, 401, {
    ok: false,
    reason: result.reason,
  });
}

async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url ?? '/', EXAMPLE_PUBLIC_BASE_URL);

  if (request.method === 'GET' && requestUrl.pathname === '/') {
    sendHtml(response, 200, renderHomePage());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/state') {
    sendJson(response, 200, publicState());
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/request-approval') {
    const result = await createApprovalRequest();

    if (requestUrl.searchParams.get('redirect') === '1') {
      redirect(response, '/');
      return;
    }

    sendJson(response, 201, {
      ok: true,
      approvalRequestId: result.request.id,
      approvalUrl: result.approvalUrl,
      request: result.request,
    });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/webhooks/approva') {
    const rawBody = await readRawBody(request);
    const verification = verifyApprovaWebhookSignature({
      rawBody,
      signatureHeader:
        typeof request.headers['x-approval-signature'] === 'string'
          ? request.headers['x-approval-signature']
          : undefined,
      timestampHeader:
        typeof request.headers['x-approval-timestamp'] === 'string'
          ? request.headers['x-approval-timestamp']
          : undefined,
      secret: WEBHOOK_SIGNING_SECRET,
    });

    if (!verification.valid) {
      verificationFailure(response, verification);
      return;
    }

    const event = parseDecisionWebhook(rawBody);

    if (
      event.eventType === 'approval_request.approved' ||
      event.eventType === 'approval_request.rejected' ||
      event.eventType === 'approval_request.expired'
    ) {
      await handleDecisionWebhook(event);
    } else {
      appendNote(`Received unsupported webhook event ${event.eventType}.`);
    }

    sendJson(response, 200, {
      ok: true,
      handledEventType: event.eventType,
    });
    return;
  }

  sendJson(response, 404, {
    ok: false,
    reason: 'Route not found.',
  });
}

createServer(async (request, response) => {
  try {
    await routeRequest(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown example app error.';
    state.stage = 'error';
    state.lastError = message;
    appendNote(`Example app error: ${message}`);
    sendJson(response, 500, {
      ok: false,
      reason: message,
    });
  }
}).listen(PORT, () => {
  appendNote(`Node deploy agent example listening on ${EXAMPLE_PUBLIC_BASE_URL}.`);
});
