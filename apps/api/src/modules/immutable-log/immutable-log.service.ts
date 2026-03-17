import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { hashCanonicalValue } from '../../common/utils/hash.util';
import { toPrismaJson } from '../../common/utils/prisma-json.util';

@Injectable()
export class ImmutableLogService {
  constructor(private readonly prisma: PrismaService) {}

  appendEvent(input: {
    organizationId: string;
    approvalRequestId?: string;
    eventType: string;
    payload: Record<string, unknown>;
  }, prisma: PrismaDbClient = this.prisma) {
    const payloadHash = hashCanonicalValue(input.payload);

    return prisma.immutableEvent.create({
      data: {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        eventType: input.eventType,
        payload: toPrismaJson(input.payload),
        payloadHash,
      },
    });
  }
}
