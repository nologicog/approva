# Webhooks

Approva sends signed JSON webhooks for terminal approval-request events in the MVP:

- `approval_request.approved`
- `approval_request.rejected`
- `approval_request.expired`

These webhook routes are internal integration points for backend systems, agents, and automation runners.

## Headers

Every webhook request includes:

- `Content-Type: application/json`
- `X-Approval-Timestamp`
- `X-Approval-Signature`

Signature format:

- header value: `v1=<hex_hmac_sha256>`
- signed input: `<timestamp>.<raw_json_payload>`
- secret: `WEBHOOK_SIGNING_SECRET`

## Verification Rules

A receiver should:

1. read the raw request body before JSON parsing
2. read `X-Approval-Timestamp`
3. read `X-Approval-Signature`
4. compute `HMAC_SHA256(secret, timestamp + "." + rawBody)`
5. compare signatures with a timing-safe comparison
6. reject requests outside a short timestamp tolerance window
7. parse JSON only after signature verification succeeds

## Reusable Node Helper

The example app includes a copy-paste helper in:

- [webhook-signature.ts](../examples/node-deploy-agent/src/webhook-signature.ts)

Core verification logic:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyApprovaWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secret: string;
  toleranceSeconds?: number;
}) {
  if (!input.signatureHeader || !input.timestampHeader) {
    return { valid: false, reason: 'Missing webhook signature headers.' };
  }

  const expectedSignature = createHmac('sha256', input.secret)
    .update(`${input.timestampHeader}.${input.rawBody}`)
    .digest('hex');

  const providedSignature = input.signatureHeader.replace(/^v1=/i, '');

  if (providedSignature.length !== expectedSignature.length) {
    return { valid: false, reason: 'Signature length mismatch.' };
  }

  const valid = timingSafeEqual(
    Buffer.from(providedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );

  return {
    valid,
    reason: valid ? null : 'Signature mismatch.',
  };
}
```

## Minimal Receiver Example

```ts
import { createServer } from 'node:http';
import { verifyApprovaWebhookSignature } from './webhook-signature';

const secret = process.env.WEBHOOK_SIGNING_SECRET ?? 'dev-webhook-signing-secret';

createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/webhooks/approva') {
    response.statusCode = 404;
    response.end();
    return;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
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
    secret,
  });

  if (!verification.valid) {
    response.statusCode = 401;
    response.end(JSON.stringify({ ok: false, reason: verification.reason }));
    return;
  }

  const event = JSON.parse(rawBody);

  switch (event.eventType) {
    case 'approval_request.approved':
      console.log('approval granted', event.payload);
      break;
    case 'approval_request.rejected':
      console.log('approval rejected', event.payload);
      break;
    case 'approval_request.expired':
      console.log('approval expired', event.payload);
      break;
    default:
      console.log('ignored event', event.eventType);
  }

  response.statusCode = 200;
  response.end(JSON.stringify({ ok: true }));
}).listen(4100);
```

## Sample Approved Payload

```json
{
  "id": "3f01c902-3c06-4429-a6b5-96f2436fe8a8",
  "approvalRequestId": "7e1c48b5-708d-402a-ae32-d5ca90b935ff",
  "eventType": "approval_request.approved",
  "occurredAt": "2026-03-16T13:45:21.000Z",
  "payload": {
    "approvalRequestId": "7e1c48b5-708d-402a-ae32-d5ca90b935ff",
    "status": "approved",
    "capabilityId": "91f8ef51-61cf-4f0a-80c0-8cfd5fe969df",
    "capabilityExchangeToken": "cex_8Fsd9Kj3l2PQx0HnV7eTsU6cM4RbYaQ",
    "capabilityExchangeExpiresAt": "2026-03-16T13:50:21.000Z"
  }
}
```

## Capability Continuation

When the approval request was created with:

- `callback.deliverCapabilityMode = exchange_token`

the approved webhook includes:

- `capabilityId`
- `capabilityExchangeToken`
- `capabilityExchangeExpiresAt`

Exchange it immediately through `POST /v1/capabilities/exchange` using the same organization API key or service-account-backed machine principal that created the request.

Approva still does **not** include the raw capability token directly in the webhook payload, and later fetches still do not reveal it by id.

This signed webhook plus exchange-token flow is the canonical first-party machine continuation path:

- [Agent Integration Guide](../docs/agent-integration.md)

## Local Test Command

Once the example app is running on `http://localhost:4100`, configure Approva callbacks to use:

- `http://localhost:4100/webhooks/approva`

Then inspect the example state at:

- [http://localhost:4100/state](http://localhost:4100/state)
