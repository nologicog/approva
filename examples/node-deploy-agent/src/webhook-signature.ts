import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookVerificationResult {
  valid: boolean;
  reason: string | null;
}

export function verifyApprovaWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}): WebhookVerificationResult {
  if (!input.signatureHeader) {
    return {
      valid: false,
      reason: 'Missing X-Approval-Signature header.',
    };
  }

  if (!input.timestampHeader) {
    return {
      valid: false,
      reason: 'Missing X-Approval-Timestamp header.',
    };
  }

  if (!/^v1=[0-9a-f]+$/i.test(input.signatureHeader)) {
    return {
      valid: false,
      reason: 'Unsupported signature format.',
    };
  }

  const unixTimestamp = Number(input.timestampHeader);

  if (!Number.isFinite(unixTimestamp)) {
    return {
      valid: false,
      reason: 'Webhook timestamp is not a valid Unix epoch seconds value.',
    };
  }

  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const now = input.now ?? Date.now();
  const ageMs = Math.abs(now - unixTimestamp * 1000);

  if (ageMs > toleranceSeconds * 1000) {
    return {
      valid: false,
      reason: 'Webhook timestamp is outside the accepted tolerance window.',
    };
  }

  const providedSignature = input.signatureHeader.replace(/^v1=/i, '');
  const expectedSignature = createHmac('sha256', input.secret)
    .update(`${input.timestampHeader}.${input.rawBody}`)
    .digest('hex');

  if (providedSignature.length !== expectedSignature.length) {
    return {
      valid: false,
      reason: 'Webhook signature length mismatch.',
    };
  }

  const isValid = timingSafeEqual(
    Buffer.from(providedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );

  return {
    valid: isValid,
    reason: isValid ? null : 'Webhook signature mismatch.',
  };
}
