import { sha256Hex } from './hash.util';

export interface LedgerHashInput {
  previousHash?: string | null;
  immutableEventSeq: number;
  eventType: string;
  payloadHash: string;
  createdAt: Date | string;
}

export interface LedgerVerificationEntry {
  sequence: number;
  previousHash: string | null;
  entryHash: string;
  createdAt: Date | string;
  immutableEvent: {
    eventType: string;
    payloadHash: string;
  };
}

export interface LedgerChainVerificationResult {
  valid: boolean;
  checkedEntries: number;
  invalidSequence?: number;
  reason?: string;
  expectedHash?: string;
  actualHash?: string;
}

export interface LedgerChainVerificationOptions {
  expectedStartingSequence?: number;
  expectedPreviousHash?: string | null;
}

export function computeLedgerEntryHash(input: LedgerHashInput): string {
  return sha256Hex(
    [
      input.previousHash ?? '',
      String(input.immutableEventSeq),
      input.eventType,
      input.payloadHash,
      normalizeCreatedAt(input.createdAt),
    ].join(''),
  );
}

export function verifyLedgerChain(
  entries: LedgerVerificationEntry[],
  options: LedgerChainVerificationOptions = {},
): LedgerChainVerificationResult {
  let expectedPreviousHash: string | null = options.expectedPreviousHash ?? null;
  let expectedSequence = options.expectedStartingSequence ?? 1;
  let checkedEntries = 0;

  for (const entry of entries) {
    if (entry.sequence !== expectedSequence) {
      return {
        valid: false,
        checkedEntries,
        invalidSequence: entry.sequence,
        reason: `Ledger sequence gap detected. Expected ${expectedSequence} but found ${entry.sequence}.`,
      };
    }

    if (entry.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        checkedEntries,
        invalidSequence: entry.sequence,
        reason:
          expectedPreviousHash === null
            ? 'Genesis ledger entry must have a null previous hash.'
            : 'Ledger previous hash does not match the prior entry hash.',
        expectedHash: expectedPreviousHash ?? undefined,
        actualHash: entry.previousHash ?? undefined,
      };
    }

    const recomputedHash = computeLedgerEntryHash({
      previousHash: entry.previousHash,
      immutableEventSeq: entry.sequence,
      eventType: entry.immutableEvent.eventType,
      payloadHash: entry.immutableEvent.payloadHash,
      createdAt: entry.createdAt,
    });

    if (entry.entryHash !== recomputedHash) {
      return {
        valid: false,
        checkedEntries,
        invalidSequence: entry.sequence,
        reason: 'Ledger entry hash does not match the recomputed deterministic hash.',
        expectedHash: recomputedHash,
        actualHash: entry.entryHash,
      };
    }

    expectedPreviousHash = entry.entryHash;
    expectedSequence += 1;
    checkedEntries += 1;
  }

  return {
    valid: true,
    checkedEntries,
  };
}

function normalizeCreatedAt(createdAt: Date | string) {
  return createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
}
