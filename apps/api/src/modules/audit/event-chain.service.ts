import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { ImmutableLogService } from '../immutable-log/immutable-log.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from './audit.service';

@Injectable()
export class EventChainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly immutableLogService: ImmutableLogService,
    private readonly ledgerService: LedgerService,
  ) {}

  async recordEvent(input: {
    organizationId: string;
    approvalRequestId?: string;
    eventType: string;
    actorType: string;
    actorId?: string;
    payload: Record<string, unknown>;
  }, prisma?: PrismaDbClient) {
    if (prisma) {
      await this.recordEventWithClient(input, prisma);
      return;
    }

    await this.prisma.$transaction(
      async (tx) => {
        await this.recordEventWithClient(input, tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async recordEventWithClient(
    input: {
      organizationId: string;
      approvalRequestId?: string;
      eventType: string;
      actorType: string;
      actorId?: string;
      payload: Record<string, unknown>;
    },
    prisma: PrismaDbClient,
  ) {
    await this.auditService.createEvent(input, prisma);

    const immutableEvent = await this.immutableLogService.appendEvent(
      {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        eventType: input.eventType,
        payload: input.payload,
      },
      prisma,
    );

    await this.ledgerService.appendEntry(
      {
        immutableEventId: immutableEvent.id,
      },
      prisma,
    );
  }
}
