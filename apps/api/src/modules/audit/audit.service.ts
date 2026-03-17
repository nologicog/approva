import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { toPrismaJson } from '../../common/utils/prisma-json.util';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  createEvent(input: {
    organizationId: string;
    approvalRequestId?: string;
    eventType: string;
    actorType: string;
    actorId?: string;
    payload: Record<string, unknown>;
  }, prisma: PrismaDbClient = this.prisma) {
    return prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        eventType: input.eventType,
        actorType: input.actorType,
        actorId: input.actorId,
        payload: toPrismaJson(input.payload),
      },
    });
  }
}
