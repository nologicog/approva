import { createHash, createHmac, randomBytes } from 'node:crypto';
import { stableStringify } from './stable-json.util';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE62_BYTE_LIMIT =
  Math.floor(256 / BASE62_ALPHABET.length) * BASE62_ALPHABET.length;

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashTokenValue(token: string): string {
  return sha256Hex(token);
}

export function hashCanonicalValue(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export function generateOpaqueToken(input: {
  prefix: string;
  randomLength: number;
}): string {
  return `${input.prefix}_${randomBase62(input.randomLength)}`;
}

export function generateCapabilityToken(): string {
  return generateOpaqueToken({
    prefix: 'cap',
    randomLength: 32,
  });
}

export function generateCapabilityExchangeToken(): string {
  return generateOpaqueToken({
    prefix: 'cex',
    randomLength: 32,
  });
}

export function buildSignedToken(input: {
  prefix: string;
  subject: string;
  secret: string;
}): string {
  const payload = `${input.prefix}:${input.subject}`;
  const signature = createHmac('sha256', input.secret).update(payload).digest('hex');

  return `${input.prefix}_${input.subject}.${signature}`;
}

export function signWebhookPayload(input: {
  secret: string;
  timestamp: string;
  payload: string;
}): string {
  const signature = createHmac('sha256', input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest('hex');

  return `v1=${signature}`;
}

function randomBase62(length: number): string {
  let result = '';

  while (result.length < length) {
    const bytes = randomBytes(Math.ceil((length - result.length) * 1.5));

    for (const value of bytes) {
      if (value >= BASE62_BYTE_LIMIT) {
        continue;
      }

      result += BASE62_ALPHABET[value % BASE62_ALPHABET.length];

      if (result.length === length) {
        break;
      }
    }
  }

  return result;
}
