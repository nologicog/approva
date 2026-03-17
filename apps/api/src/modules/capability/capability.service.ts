import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ExchangeCapabilityResponse,
  CapabilityInvalidReason,
  CapabilityUseResult,
  CapabilityVerificationResult,
} from '@approva/shared';
import { MachinePrincipalType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { RequestContextService } from '../../common/observability/request-context.service';
import { decryptApplicationValue, encryptApplicationValue } from '../../common/utils/application-encryption.util';
import { toCapability } from '../../common/utils/domain.mapper';
import {
  generateCapabilityExchangeToken,
  generateCapabilityToken,
  hashCanonicalValue,
  hashTokenValue,
} from '../../common/utils/hash.util';
import { EventChainService } from '../audit/event-chain.service';
import {
  type OrganizationContextInput,
  OrganizationsService,
} from '../organizations/organizations.service';
import type { MachineAuthPrincipal } from '../machine-auth/machine-auth.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

const CAPABILITY_INCLUDE = {
  approvalRequest: {
    include: {
      decision: true,
    },
  },
} satisfies Prisma.CapabilityInclude;

type CapabilityRecord = Prisma.CapabilityGetPayload<{
  include: typeof CAPABILITY_INCLUDE;
}>;

const CAPABILITY_EXCHANGE_INCLUDE = {
  capability: {
    include: CAPABILITY_INCLUDE,
  },
  approvalRequest: {
    include: {
      decision: true,
    },
  },
} satisfies Prisma.CapabilityExchangeTokenInclude;

type CapabilityExchangeRecord = Prisma.CapabilityExchangeTokenGetPayload<{
  include: typeof CAPABILITY_EXCHANGE_INCLUDE;
}>;

type CapabilityEvaluation =
  | {
      valid: true;
      approvalRequestId: string;
      capability: CapabilityRecord;
    }
  | {
      valid: false;
      approvalRequestId?: string | null;
      invalidReason: CapabilityInvalidReason;
    };

@Injectable()
export class CapabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventChainService: EventChainService,
    private readonly organizationsService: OrganizationsService,
    private readonly requestContextService: RequestContextService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async issueCapability(
    input: {
      organizationId: string;
      approvalRequestId: string;
      action: string;
      resource: {
        type: string;
        id: string;
      };
      paramsHash: string;
      expiresAt: Date;
    },
    prisma: PrismaDbClient = this.prisma,
  ) {
    const token = generateCapabilityToken();
    const capability = await prisma.capability.create({
      data: {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        action: input.action,
        resourceType: input.resource.type,
        resourceId: input.resource.id,
        paramsHash: input.paramsHash,
        tokenHash: hashTokenValue(token),
        expiresAt: input.expiresAt,
      },
    });

    this.requestContextService.setContext({
      organizationId: input.organizationId,
      approvalRequestId: input.approvalRequestId,
    });

    return toCapability(capability, token);
  }

  async createCapabilityExchangeToken(
    input: {
      organizationId: string;
      approvalRequestId: string;
      capabilityId: string;
      capabilityToken: string;
      capabilityExpiresAt: Date;
      callbackUrl?: string | null;
      machinePrincipalBinding?: {
        type: MachinePrincipalType;
        id: string;
      } | null;
    },
    prisma: PrismaDbClient = this.prisma,
  ) {
    const exchangeToken = generateCapabilityExchangeToken();
    const expiresAt = this.resolveExchangeExpiry(input.capabilityExpiresAt);

    const record = await prisma.capabilityExchangeToken.create({
      data: {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        capabilityId: input.capabilityId,
        exchangeTokenHash: hashTokenValue(exchangeToken),
        encryptedCapabilityToken: encryptApplicationValue(input.capabilityToken),
        callbackUrl: input.callbackUrl ?? null,
        machinePrincipalType: input.machinePrincipalBinding?.type,
        machinePrincipalId: input.machinePrincipalBinding?.id ?? null,
        expiresAt,
      },
    });

    this.requestContextService.setContext({
      organizationId: input.organizationId,
      approvalRequestId: input.approvalRequestId,
      userId: input.machinePrincipalBinding
        ? `${input.machinePrincipalBinding.type}:${input.machinePrincipalBinding.id}`
        : null,
    });

    return {
      id: record.id,
      token: exchangeToken,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  async verifyCapability(input: {
    token: string;
    action: string;
    resource: {
      type: string;
      id: string;
    };
    params?: Record<string, unknown> | unknown[] | null;
  }, organizationInput: OrganizationContextInput = {},
  _machinePrincipal?: MachineAuthPrincipal | null,
  ): Promise<CapabilityVerificationResult> {
    const organizationId = await this.resolveOptionalOrganizationId(organizationInput);
    if (organizationId) {
      await this.rateLimitService.enforceOrganizationLimit({
        organizationId,
        bucket: 'capability-verify',
        limit: this.rateLimitService.getOrganizationCapabilityVerificationLimit(),
        message: 'Organization capability verification rate limit exceeded.',
      });
    }
    const evaluation = await this.evaluateCapability(input, this.prisma, organizationId);

    if (!evaluation.valid) {
      return this.invalidVerificationResult(
        evaluation.invalidReason,
        evaluation.approvalRequestId ?? null,
      );
    }

    return {
      valid: true,
      approvalRequestId: evaluation.approvalRequestId,
      capability: toCapability(evaluation.capability),
    };
  }

  async exchangeCapability(
    exchangeToken: string,
    machinePrincipal: MachineAuthPrincipal,
  ): Promise<ExchangeCapabilityResponse> {
    await this.rateLimitService.enforceOrganizationLimit({
      organizationId: machinePrincipal.organizationId,
      bucket: 'capability-verify',
      limit: this.rateLimitService.getOrganizationCapabilityVerificationLimit(),
      message: 'Organization capability verification rate limit exceeded.',
    });

    return this.runSerializableTransaction(async (tx) => {
      const exchange = await tx.capabilityExchangeToken.findFirst({
        where: {
          exchangeTokenHash: hashTokenValue(exchangeToken),
          organizationId: machinePrincipal.organizationId,
        },
        include: CAPABILITY_EXCHANGE_INCLUDE,
      });

      if (!exchange) {
        throw new ForbiddenException('Capability exchange token is invalid.');
      }

      this.requestContextService.setContext({
        organizationId: exchange.organizationId,
        approvalRequestId: exchange.approvalRequestId,
        userId: machinePrincipal.serviceAccountId
          ? `service-account:${machinePrincipal.serviceAccountId}`
          : `api-key:${machinePrincipal.apiKeyId}`,
      });

      this.assertExchangeTokenUsable(exchange);
      this.assertExchangePrincipalAuthorized(exchange, machinePrincipal);

      const encryptedCapabilityToken = exchange.encryptedCapabilityToken;

      if (!encryptedCapabilityToken) {
        throw new ConflictException('Capability exchange token has already been used.');
      }

      const capabilityToken = decryptApplicationValue(encryptedCapabilityToken);
      const exchangedAt = new Date();
      const updateResult = await tx.capabilityExchangeToken.updateMany({
        where: {
          id: exchange.id,
          organizationId: exchange.organizationId,
          usedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: exchangedAt,
          },
        },
        data: {
          usedAt: exchangedAt,
          encryptedCapabilityToken: null,
        },
      });

      if (updateResult.count !== 1) {
        const refreshedExchange = await tx.capabilityExchangeToken.findUnique({
          where: {
            id: exchange.id,
          },
          include: CAPABILITY_EXCHANGE_INCLUDE,
        });

        if (!refreshedExchange) {
          throw new ForbiddenException('Capability exchange token is invalid.');
        }

        this.assertExchangeTokenUsable(refreshedExchange);
        throw new ConflictException('Capability exchange token has already been used.');
      }

      await this.eventChainService.recordEvent(
        {
          organizationId: exchange.organizationId,
          approvalRequestId: exchange.approvalRequestId,
          eventType: 'capability.exchanged',
          actorType: 'machine',
          actorId: machinePrincipal.serviceAccountId ?? machinePrincipal.apiKeyId,
          payload: {
            approvalRequestId: exchange.approvalRequestId,
            capabilityId: exchange.capabilityId,
            capabilityExchangeTokenId: exchange.id,
            exchangedAt: exchangedAt.toISOString(),
            machineAuth: this.buildMachineAuthMetadata(machinePrincipal),
          },
        },
        tx,
      );

      return {
        capabilityToken,
        expiresAt: exchange.capability.expiresAt.toISOString(),
        scope: {
          action: exchange.capability.action,
          resource: {
            type: exchange.capability.resourceType,
            id: exchange.capability.resourceId,
          },
          paramsHash: exchange.capability.paramsHash,
        },
      };
    });
  }

  async useCapability(input: {
    token: string;
    action: string;
    resource: {
      type: string;
      id: string;
    };
    params?: Record<string, unknown> | unknown[] | null;
  }, organizationInput: OrganizationContextInput = {},
  machinePrincipal?: MachineAuthPrincipal | null,
  ): Promise<CapabilityUseResult> {
    const organizationId = await this.resolveOptionalOrganizationId(organizationInput);
    if (organizationId) {
      await this.rateLimitService.enforceOrganizationLimit({
        organizationId,
        bucket: 'capability-verify',
        limit: this.rateLimitService.getOrganizationCapabilityVerificationLimit(),
        message: 'Organization capability verification rate limit exceeded.',
      });
    }
    return this.runSerializableTransaction(async (tx) => {
      const evaluation = await this.evaluateCapability(input, tx, organizationId);

      if (!evaluation.valid) {
        return this.invalidUseResult(
          evaluation.invalidReason,
          evaluation.approvalRequestId ?? null,
        );
      }

      await this.eventChainService.recordEvent(
        {
          organizationId: evaluation.capability.organizationId,
          approvalRequestId: evaluation.capability.approvalRequestId,
          eventType: 'capability.used',
          actorType: machinePrincipal ? 'machine' : 'system',
          actorId:
            machinePrincipal?.serviceAccountId ??
            machinePrincipal?.apiKeyId ??
            evaluation.capability.approvalRequest.requestedBySystem,
          payload: {
            approvalRequestId: evaluation.capability.approvalRequestId,
            capabilityId: evaluation.capability.id,
            action: evaluation.capability.action,
            resource: {
              type: evaluation.capability.resourceType,
              id: evaluation.capability.resourceId,
            },
            paramsHash: evaluation.capability.paramsHash,
            usedAt: new Date().toISOString(),
            machineAuth: machinePrincipal
              ? {
                  apiKeyId: machinePrincipal.apiKeyId,
                  apiKeyName: machinePrincipal.apiKeyName,
                  keyPrefix: machinePrincipal.keyPrefix,
                  serviceAccountId: machinePrincipal.serviceAccountId ?? null,
                  serviceAccountName: machinePrincipal.serviceAccountName ?? null,
                  scopes: machinePrincipal.scopes,
                }
              : null,
          },
        },
        tx,
      );

      return {
        valid: true,
        approvalRequestId: evaluation.capability.approvalRequestId,
      };
    });
  }

  private async evaluateCapability(
    input: {
      token: string;
      action: string;
      resource: {
        type: string;
        id: string;
      };
      params?: Record<string, unknown> | unknown[] | null;
    },
    prisma: PrismaDbClient = this.prisma,
    organizationId?: string | null,
  ): Promise<CapabilityEvaluation> {
    const tokenHash = hashTokenValue(input.token);
    const capability = organizationId
      ? await prisma.capability.findFirst({
          where: {
            tokenHash,
            organizationId,
          },
          include: CAPABILITY_INCLUDE,
        })
      : await prisma.capability.findUnique({
          where: {
            tokenHash,
          },
          include: CAPABILITY_INCLUDE,
        });

    if (!capability) {
      return this.invalidResult({
        code: 'token_not_found',
        message: 'Capability token not found.',
      });
    }

    this.requestContextService.setContext({
      organizationId: capability.organizationId,
      approvalRequestId: capability.approvalRequestId,
    });

    if (organizationId && capability.organizationId !== organizationId) {
      return this.invalidResult(
        {
          code: 'token_not_found',
          message: 'Capability token not found.',
        },
        capability.approvalRequestId,
      );
    }

    if (capability.expiresAt.getTime() <= Date.now()) {
      return this.invalidResult(
        {
          code: 'token_expired',
          message: 'Capability token has expired.',
        },
        capability.approvalRequestId,
      );
    }

    if (capability.revokedAt) {
      return this.invalidResult(
        {
          code: 'token_revoked',
          message: 'Capability token has been revoked.',
        },
        capability.approvalRequestId,
      );
    }

    const grantedStatuses = new Set(['approved', 'auto_approved']);

    if (!grantedStatuses.has(capability.approvalRequest.status)) {
      return this.invalidResult(
        {
          code: 'request_not_granted',
          message: 'Capability is not backed by a granted approval request.',
        },
        capability.approvalRequestId,
      );
    }

    if (!capability.approvalRequest.decision) {
      return this.invalidResult(
        {
          code: 'decision_missing',
          message: 'Capability is not backed by a recorded approval decision.',
        },
        capability.approvalRequestId,
      );
    }

    if (capability.action !== input.action) {
      return this.invalidResult(
        {
          code: 'action_mismatch',
          message: 'Capability action does not match.',
        },
        capability.approvalRequestId,
      );
    }

    if (capability.resourceType !== input.resource.type) {
      return this.invalidResult(
        {
          code: 'resource_type_mismatch',
          message: 'Capability resource type does not match.',
        },
        capability.approvalRequestId,
      );
    }

    if (capability.resourceId !== input.resource.id) {
      return this.invalidResult(
        {
          code: 'resource_id_mismatch',
          message: 'Capability resource id does not match.',
        },
        capability.approvalRequestId,
      );
    }

    const paramsHash = hashCanonicalValue(input.params ?? null);

    if (capability.paramsHash !== paramsHash) {
      return this.invalidResult(
        {
          code: 'params_mismatch',
          message: 'Capability params hash does not match.',
        },
        capability.approvalRequestId,
      );
    }

    return {
      valid: true,
      approvalRequestId: capability.approvalRequestId,
      capability,
    };
  }

  private invalidResult(
    invalidReason: CapabilityInvalidReason,
    approvalRequestId?: string | null,
  ): CapabilityEvaluation {
    return {
      valid: false,
      approvalRequestId: approvalRequestId ?? null,
      invalidReason,
    };
  }

  private invalidVerificationResult(
    reason: CapabilityInvalidReason,
    approvalRequestId?: string | null,
  ): CapabilityVerificationResult {
    return {
      valid: false,
      approvalRequestId: approvalRequestId ?? null,
      reason: reason.message,
      invalidReason: reason,
    };
  }

  private invalidUseResult(
    reason: CapabilityInvalidReason,
    approvalRequestId?: string | null,
  ): CapabilityUseResult {
    return {
      valid: false,
      approvalRequestId: approvalRequestId ?? null,
      reason: reason.message,
      invalidReason: reason,
    };
  }

  private assertExchangeTokenUsable(exchange: CapabilityExchangeRecord) {
    if (exchange.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Capability exchange token has expired.');
    }

    if (exchange.revokedAt) {
      throw new ConflictException('Capability exchange token has been revoked.');
    }

    if (exchange.usedAt) {
      throw new ConflictException('Capability exchange token has already been used.');
    }

    if (exchange.capability.revokedAt) {
      throw new ConflictException('The backing capability has been revoked.');
    }

    if (exchange.capability.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('The backing capability has expired.');
    }

    if (!new Set(['approved', 'auto_approved']).has(exchange.approvalRequest.status)) {
      throw new ConflictException(
        'The backing approval request is not currently in a granted state.',
      );
    }

    if (!exchange.approvalRequest.decision) {
      throw new ConflictException(
        'The backing approval request does not have a recorded decision.',
      );
    }
  }

  private assertExchangePrincipalAuthorized(
    exchange: CapabilityExchangeRecord,
    machinePrincipal: MachineAuthPrincipal,
  ) {
    if (!exchange.machinePrincipalType || !exchange.machinePrincipalId) {
      return;
    }

    if (exchange.machinePrincipalType === MachinePrincipalType.service_account) {
      if (machinePrincipal.serviceAccountId !== exchange.machinePrincipalId) {
        throw new UnauthorizedException(
          'Capability exchange token is not valid for this service account.',
        );
      }

      return;
    }

    if (machinePrincipal.apiKeyId !== exchange.machinePrincipalId) {
      throw new UnauthorizedException(
        'Capability exchange token is not valid for this API key.',
      );
    }
  }

  private resolveExchangeExpiry(capabilityExpiresAt: Date) {
    const ttlMinutes = Number(process.env.CAPABILITY_EXCHANGE_TOKEN_TTL_MINUTES ?? 5);
    const exchangeExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return capabilityExpiresAt.getTime() < exchangeExpiresAt.getTime()
      ? capabilityExpiresAt
      : exchangeExpiresAt;
  }

  private buildMachineAuthMetadata(machinePrincipal?: MachineAuthPrincipal | null) {
    if (!machinePrincipal) {
      return null;
    }

    return {
      apiKeyId: machinePrincipal.apiKeyId,
      apiKeyName: machinePrincipal.apiKeyName,
      keyPrefix: machinePrincipal.keyPrefix,
      serviceAccountId: machinePrincipal.serviceAccountId ?? null,
      serviceAccountName: machinePrincipal.serviceAccountName ?? null,
      scopes: machinePrincipal.scopes,
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

  private async resolveOptionalOrganizationId(
    organizationInput: OrganizationContextInput,
  ): Promise<string | null> {
    if (!this.hasExplicitOrganizationContext(organizationInput)) {
      return null;
    }

    return (await this.organizationsService.resolveOrganization(organizationInput)).id;
  }

  private hasExplicitOrganizationContext(input: OrganizationContextInput) {
    return Boolean(input.organizationId?.trim() || input.organizationSlug?.trim());
  }
}
