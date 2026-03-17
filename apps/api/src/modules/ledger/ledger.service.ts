import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import {
  computeLedgerEntryHash,
  verifyLedgerChain as verifyDeterministicLedgerChain,
} from '../../common/utils/ledger-hash.util';
import {
  type OrganizationContextInput,
  OrganizationsService,
} from '../organizations/organizations.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async appendEntry(
    input: { immutableEventId: string },
    prisma: PrismaDbClient = this.prisma,
  ) {
    await prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(84017431)');

    const immutableEvent = await prisma.immutableEvent.findUniqueOrThrow({
      where: {
        id: input.immutableEventId,
      },
      select: {
        id: true,
        organizationId: true,
        eventType: true,
        payloadHash: true,
      },
    });

    const previousEntry = await prisma.ledgerEntry.findFirst({
      where: {
        organizationId: immutableEvent.organizationId,
      },
      orderBy: {
        sequence: 'desc',
      },
    });

    const sequence = (previousEntry?.sequence ?? 0) + 1;
    const createdAt = new Date();
    const entryHash = computeLedgerEntryHash({
      previousHash: previousEntry?.entryHash ?? null,
      immutableEventSeq: sequence,
      eventType: immutableEvent.eventType,
      payloadHash: immutableEvent.payloadHash,
      createdAt,
    });

    return prisma.ledgerEntry.create({
      data: {
        organizationId: immutableEvent.organizationId,
        immutableEventId: immutableEvent.id,
        sequence,
        previousHash: previousEntry?.entryHash ?? null,
        entryHash,
        createdAt,
      },
    });
  }

  async verifyLedgerChain(
    organizationInput: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ) {
    return this.verifyLedgerRange(undefined, organizationInput, prisma);
  }

  async verifyLedgerRange(
    input?: {
      fromSeq?: number;
      toSeq?: number;
    },
    organizationInput: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ) {
    if (input?.fromSeq && input?.toSeq && input.fromSeq > input.toSeq) {
      throw new BadRequestException('fromSeq must be less than or equal to toSeq.');
    }

    const organization = await this.organizationsService.resolveOrganization(
      organizationInput,
      prisma,
    );
    const organizationId = organization.id;
    const fromSeq = input?.fromSeq;
    const toSeq = input?.toSeq;
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        organizationId,
        ...(fromSeq ? { sequence: { gte: fromSeq } } : {}),
        ...(toSeq
          ? {
              sequence: {
                ...(fromSeq ? { gte: fromSeq } : {}),
                lte: toSeq,
              },
            }
          : {}),
      },
      orderBy: {
        sequence: 'asc',
      },
      include: {
        immutableEvent: {
          select: {
            eventType: true,
            payloadHash: true,
          },
        },
      },
    });

    if (entries.length === 0) {
      return this.formatVerificationResult({
        valid: true,
        checkedEntries: 0,
      });
    }

    const firstEntry = entries[0];
    const expectedStartingSequence = fromSeq ?? firstEntry.sequence;

    if (!fromSeq && firstEntry.sequence !== 1) {
      return this.formatVerificationResult({
        valid: false,
        checkedEntries: 0,
        invalidSequence: firstEntry.sequence,
        reason: `Ledger sequence gap detected. Expected 1 but found ${firstEntry.sequence}.`,
      });
    }

    let expectedPreviousHash: string | null = null;

    if (expectedStartingSequence > 1) {
      const previousEntry = await prisma.ledgerEntry.findUnique({
        where: {
          organizationId_sequence: {
            organizationId,
            sequence: expectedStartingSequence - 1,
          },
        },
        select: {
          entryHash: true,
        },
      });

      if (!previousEntry) {
        return this.formatVerificationResult({
          valid: false,
          checkedEntries: 0,
          invalidSequence: expectedStartingSequence,
          reason: 'Missing previous ledger entry before the requested verification range.',
        });
      }

      expectedPreviousHash = previousEntry.entryHash;
    }

    return this.formatVerificationResult(
      verifyDeterministicLedgerChain(entries, {
        expectedStartingSequence,
        expectedPreviousHash,
      }),
    );
  }

  private formatVerificationResult(input: {
    valid: boolean;
    checkedEntries: number;
    invalidSequence?: number;
    reason?: string;
  }) {
    return {
      valid: input.valid,
      checkedEntries: input.checkedEntries,
      firstInvalidSeq: input.invalidSequence ?? null,
      reason: input.reason ?? null,
    };
  }
}
