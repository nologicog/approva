import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyApprovaWebhookSignature({
  rawBody,
  signatureHeader,
  timestampHeader,
  secret,
  toleranceSeconds = 300,
  now = Date.now(),
}) {
  if (!signatureHeader) {
    return {
      valid: false,
      reason: 'Missing X-Approval-Signature header.',
    };
  }

  if (!timestampHeader) {
    return {
      valid: false,
      reason: 'Missing X-Approval-Timestamp header.',
    };
  }

  if (!/^v1=[0-9a-f]+$/i.test(signatureHeader)) {
    return {
      valid: false,
      reason: 'Unsupported signature format.',
    };
  }

  const unixTimestamp = Number(timestampHeader);

  if (!Number.isFinite(unixTimestamp)) {
    return {
      valid: false,
      reason: 'Webhook timestamp is not a valid Unix epoch seconds value.',
    };
  }

  const ageMs = Math.abs(now - unixTimestamp * 1000);

  if (ageMs > toleranceSeconds * 1000) {
    return {
      valid: false,
      reason: 'Webhook timestamp is outside the accepted tolerance window.',
    };
  }

  const providedSignature = signatureHeader.replace(/^v1=/i, '');
  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  if (providedSignature.length !== expectedSignature.length) {
    return {
      valid: false,
      reason: 'Webhook signature length mismatch.',
    };
  }

  const valid = timingSafeEqual(
    Buffer.from(providedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );

  return {
    valid,
    reason: valid ? null : 'Webhook signature mismatch.',
  };
}
