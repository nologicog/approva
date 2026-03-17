import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DemoDeploymentExecutionResult,
  DemoTimelineEntry,
  DemoTimelineResponse,
  ImportantEventType,
} from '@approva/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashCanonicalValue } from '../../common/utils/hash.util';
import { EventChainService } from '../audit/event-chain.service';

const DEMO_EVENT_TYPES: ImportantEventType[] = [
  'approval_request.created',
  'approval_request.pending',
  'approval_request.approved',
  'capability.issued',
  'capability.used',
  'deployment.executed',
];

@Injectable()
export class DemoAiDeployService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventChainService: EventChainService,
  ) {}

  async getTimeline(approvalRequestId: string): Promise<DemoTimelineResponse> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: {
        id: approvalRequestId,
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found.');
    }

    const [immutableEvents, auditEvents] = await Promise.all([
      this.prisma.immutableEvent.findMany({
        where: {
          organizationId: request.organizationId,
          approvalRequestId,
          eventType: {
            in: DEMO_EVENT_TYPES,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          ledgerEntry: {
            select: {
              sequence: true,
              entryHash: true,
            },
          },
        },
      }),
      this.prisma.auditEvent.findMany({
        where: {
          organizationId: request.organizationId,
          approvalRequestId,
          eventType: {
            in: DEMO_EVENT_TYPES,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          eventType: true,
          actorType: true,
          actorId: true,
          payload: true,
        },
      }),
    ]);

    const auditQueues = new Map<
      string,
      Array<{
        actorType: string;
        actorId: string | null;
      }>
    >();

    for (const auditEvent of auditEvents) {
      const payload = this.normalizePayload(auditEvent.payload);
      const key = this.buildEventKey(auditEvent.eventType, hashCanonicalValue(payload));
      const queue = auditQueues.get(key) ?? [];

      queue.push({
        actorType: auditEvent.actorType,
        actorId: auditEvent.actorId,
      });

      auditQueues.set(key, queue);
    }

    const timeline: DemoTimelineEntry[] = immutableEvents.map((immutableEvent) => {
      const payload = this.normalizePayload(immutableEvent.payload);
      const key = this.buildEventKey(immutableEvent.eventType, immutableEvent.payloadHash);
      const auditMatch = auditQueues.get(key)?.shift();

      return {
        eventType: immutableEvent.eventType as ImportantEventType,
        createdAt: immutableEvent.createdAt.toISOString(),
        actorType: auditMatch?.actorType ?? null,
        actorId: auditMatch?.actorId ?? null,
        payload,
        payloadHash: immutableEvent.payloadHash,
        ledgerSequence: immutableEvent.ledgerEntry?.sequence ?? null,
        ledgerEntryHash: immutableEvent.ledgerEntry?.entryHash ?? null,
      };
    });

    return {
      approvalRequestId: request.id,
      requestStatus: request.status,
      deploymentExecuted: timeline.some((entry) => entry.eventType === 'deployment.executed'),
      timeline,
    };
  }

  async executeDeployment(
    approvalRequestId: string,
  ): Promise<DemoDeploymentExecutionResult> {
    return this.runSerializableTransaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({
        where: {
          id: approvalRequestId,
        },
        select: {
          id: true,
          organizationId: true,
          status: true,
          action: true,
          resourceType: true,
          resourceId: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Approval request not found.');
      }

      if (!['approved', 'auto_approved'].includes(request.status)) {
        throw new ConflictException(
          'Deployment can only be executed after the approval request is granted.',
        );
      }

      const capabilityUse = await tx.immutableEvent.findFirst({
        where: {
          organizationId: request.organizationId,
          approvalRequestId,
          eventType: 'capability.used',
        },
        select: {
          id: true,
        },
      });

      if (!capabilityUse) {
        throw new ConflictException(
          'The deploy agent must use the issued capability before execution is recorded.',
        );
      }

      const existingExecution = await tx.immutableEvent.findFirst({
        where: {
          organizationId: request.organizationId,
          approvalRequestId,
          eventType: 'deployment.executed',
        },
        select: {
          id: true,
        },
      });

      if (existingExecution) {
        return {
          approvalRequestId,
          executed: true,
        };
      }

      const executedAt = new Date().toISOString();

      await this.eventChainService.recordEvent(
        {
          organizationId: request.organizationId,
          approvalRequestId,
          eventType: 'deployment.executed',
          actorType: 'system',
          actorId: 'ai-deploy-agent',
          payload: {
            approvalRequestId,
            action: request.action,
            resource: {
              type: request.resourceType,
              id: request.resourceId,
            },
            environment: 'production',
            version: '2026.03.16-demo',
            region: 'eu-west-1',
            executedAt,
            deploymentStatus: 'executed',
          },
        },
        tx,
      );

      return {
        approvalRequestId,
        executed: true,
      };
    });
  }

  private buildEventKey(eventType: string, payloadHash: string) {
    return `${eventType}:${payloadHash}`;
  }

  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }

    return {
      value: payload,
    };
  }

  private async runSerializableTransaction<T>(
    operation: (prisma: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isRetryableTransactionError(error) || attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw new ConflictException('Transaction retry limit exceeded.');
  }

  private isRetryableTransactionError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2034'
    );
  }
}
