import type {
  ApprovalDecision,
  ApprovalRequest,
  ApproverUser,
  Capability,
  PolicyResult,
} from '@approva/shared';
import type {
  ApprovalDecision as PrismaApprovalDecision,
  ApprovalRequest as PrismaApprovalRequest,
  ApproverUser as PrismaApproverUser,
  Capability as PrismaCapability,
} from '@prisma/client';

type RequestWithRelations = PrismaApprovalRequest & {
  decision?: PrismaApprovalDecision | null;
  capability?: PrismaCapability | null;
};

export function toCapability(
  capability: PrismaCapability,
  token?: string,
): Capability {
  return {
    id: capability.id,
    organizationId: capability.organizationId,
    approvalRequestId: capability.approvalRequestId,
    action: capability.action,
    resource: {
      type: capability.resourceType,
      id: capability.resourceId,
    },
    paramsHash: capability.paramsHash,
    expiresAt: capability.expiresAt.toISOString(),
    issuedAt: capability.issuedAt.toISOString(),
    revokedAt: capability.revokedAt?.toISOString() ?? null,
    token,
  };
}

export function toApprovalDecision(decision: PrismaApprovalDecision): ApprovalDecision {
  return {
    id: decision.id,
    organizationId: decision.organizationId,
    approvalRequestId: decision.approvalRequestId,
    decision: decision.decision,
    approverId: decision.approverId,
    approverDisplayName: decision.approverDisplayName,
    reason: decision.reason,
    authMethod: decision.authMethod,
    authContext: (decision.authContext as Record<string, unknown> | null) ?? null,
    createdAt: decision.createdAt.toISOString(),
  };
}

export function toApprovalRequest(request: RequestWithRelations): ApprovalRequest {
  return {
    id: request.id,
    organizationId: request.organizationId,
    externalRequestId: request.externalRequestId,
    requestedBy: {
      system: request.requestedBySystem,
      actorId: request.requestedByActorId,
    },
    action: request.action,
    resource: {
      type: request.resourceType,
      id: request.resourceId,
    },
    params: request.params as Record<string, unknown> | unknown[] | null,
    paramsHash: request.paramsHash,
    riskLevel: request.riskLevel,
    status: request.status,
    callbackUrl: request.callbackUrl,
    callback: request.callbackUrl
      ? {
          webhookUrl: request.callbackUrl,
          deliverCapabilityMode: request.deliverCapabilityMode,
        }
      : null,
    policyResult: request.policyResult as unknown as PolicyResult,
    expiresAt: request.expiresAt?.toISOString() ?? null,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    latestDecision: request.decision ? toApprovalDecision(request.decision) : null,
    capability: request.capability ? toCapability(request.capability) : null,
  };
}

export function toApproverUser(user: PrismaApproverUser): ApproverUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
