import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  buildSignedToken,
  hashCanonicalValue,
  hashTokenValue,
} from '../apps/api/src/common/utils/hash.util';
import { computeLedgerEntryHash } from '../apps/api/src/common/utils/ledger-hash.util';

const prisma = new PrismaClient();

async function main() {
  const defaultOrganizationName =
    process.env.AUTHON_DEFAULT_ORGANIZATION_NAME ?? 'Default Organization';
  const defaultOrganizationSlug =
    process.env.AUTHON_DEFAULT_ORGANIZATION_SLUG ?? 'default';

  const organization = await prisma.organization.upsert({
    where: {
      slug: defaultOrganizationSlug,
    },
    update: {
      name: defaultOrganizationName,
    },
    create: {
      name: defaultOrganizationName,
      slug: defaultOrganizationSlug,
    },
  });

  const approverUser = await prisma.approverUser.upsert({
    where: {
      email: 'approver@example.com',
    },
    update: {
      displayName: 'Jordan Vale',
      status: 'active',
    },
    create: {
      email: 'approver@example.com',
      displayName: 'Jordan Vale',
      status: 'active',
    },
  });

  const defaultPolicies = [
    {
      action: '*',
      resourceType: '*',
      riskLevel: 'high' as const,
      approvalRequired: true,
      approverRoles: ['owner', 'admin', 'approver'] as const,
    },
    {
      action: '*',
      resourceType: '*',
      riskLevel: 'critical' as const,
      approvalRequired: true,
      approverRoles: ['owner', 'admin', 'approver'] as const,
    },
  ];

  for (const policy of defaultPolicies) {
    const existingPolicy = await prisma.policy.findFirst({
      where: {
        organizationId: organization.id,
        action: policy.action,
        resourceType: policy.resourceType,
        riskLevel: policy.riskLevel,
      },
      select: {
        id: true,
      },
    });

    if (existingPolicy) {
      await prisma.policy.update({
        where: {
          id: existingPolicy.id,
        },
        data: {
          approvalRequired: policy.approvalRequired,
          approverRoles: [...policy.approverRoles],
        },
      });
    } else {
      await prisma.policy.create({
        data: {
          organizationId: organization.id,
          action: policy.action,
          resourceType: policy.resourceType,
          riskLevel: policy.riskLevel,
          approvalRequired: policy.approvalRequired,
          approverRoles: [...policy.approverRoles],
        },
      });
    }
  }

  const requestId = randomUUID();
  const params = {
    environment: 'production',
    service: 'payments-worker',
    version: '2026.03.15',
  };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const approvalAccessToken = buildSignedToken({
    prefix: 'aat',
    subject: requestId,
    secret: process.env.APPROVAL_ACCESS_TOKEN_SECRET ?? 'dev-approval-access-secret',
  });

  const approvalRequest = await prisma.approvalRequest.create({
    data: {
      organizationId: organization.id,
      id: requestId,
      externalRequestId: 'seed-ext-approval-request',
      requestedBySystem: 'seed-script',
      requestedByActorId: 'seed-user',
      idempotencyKey: 'seed-approval-request',
      requestFingerprintHash: hashCanonicalValue({
        externalRequestId: 'seed-ext-approval-request',
        requestedBy: {
          system: 'seed-script',
          actorId: 'seed-user',
        },
        action: 'deploy production release',
        riskLevel: 'high',
        resource: {
          type: 'service',
          id: 'payments-worker',
        },
        params,
        callbackUrl: null,
        expiresAt: expiresAt.toISOString(),
      }),
      approvalAccessTokenHash: hashTokenValue(approvalAccessToken),
      action: 'deploy production release',
      resourceType: 'service',
      resourceId: 'payments-worker',
      params,
      paramsHash: hashCanonicalValue(params),
      riskLevel: 'high',
      status: 'pending',
      callbackUrl: null,
      policyResult: {
        decision: 'approval_required',
        requiresApproval: true,
        matchedRules: ['policy.seed-default-high-risk'],
        reasons: [
          'Risk level high requires approval.',
          'Matched the seeded default high-risk approval policy.',
        ],
        evaluatedAt: new Date().toISOString(),
        matchedPolicyId: null,
        approverRoles: ['owner', 'admin', 'approver'],
      },
      expiresAt,
    },
  });

  const createdPayload = {
    approvalRequestId: approvalRequest.id,
    status: approvalRequest.status,
    action: approvalRequest.action,
  };

  const pendingPayload = {
    approvalRequestId: approvalRequest.id,
    status: approvalRequest.status,
    notification: 'pending_approval_stubbed',
  };

  const immutableCreated = await prisma.immutableEvent.create({
    data: {
      organizationId: organization.id,
      approvalRequestId: approvalRequest.id,
      eventType: 'approval_request.created',
      payload: createdPayload,
      payloadHash: hashCanonicalValue(createdPayload),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        organizationId: organization.id,
        approvalRequestId: approvalRequest.id,
        eventType: 'approval_request.created',
        actorType: 'system',
        actorId: 'seed-script',
        payload: createdPayload,
      },
      {
        organizationId: organization.id,
        approvalRequestId: approvalRequest.id,
        eventType: 'approval_request.pending',
        actorType: 'system',
        actorId: 'seed-script',
        payload: pendingPayload,
      },
    ],
  });

  const ledgerOneCreatedAt = new Date();
  const ledgerOneHash = computeLedgerEntryHash({
    previousHash: null,
    immutableEventSeq: 1,
    eventType: immutableCreated.eventType,
    payloadHash: immutableCreated.payloadHash,
    createdAt: ledgerOneCreatedAt,
  });

  await prisma.ledgerEntry.create({
    data: {
      organizationId: organization.id,
      immutableEventId: immutableCreated.id,
      sequence: 1,
      previousHash: null,
      entryHash: ledgerOneHash,
      createdAt: ledgerOneCreatedAt,
    },
  });

  const immutablePending = await prisma.immutableEvent.create({
    data: {
      organizationId: organization.id,
      approvalRequestId: approvalRequest.id,
      eventType: 'approval_request.pending',
      payload: pendingPayload,
      payloadHash: hashCanonicalValue(pendingPayload),
    },
  });

  const ledgerTwoCreatedAt = new Date();
  const ledgerTwoHash = computeLedgerEntryHash({
    previousHash: ledgerOneHash,
    immutableEventSeq: 2,
    eventType: immutablePending.eventType,
    payloadHash: immutablePending.payloadHash,
    createdAt: ledgerTwoCreatedAt,
  });

  await prisma.ledgerEntry.create({
    data: {
      organizationId: organization.id,
      immutableEventId: immutablePending.id,
      sequence: 2,
      previousHash: ledgerOneHash,
      entryHash: ledgerTwoHash,
      createdAt: ledgerTwoCreatedAt,
    },
  });

  const approvalUrl = new URL(
    `/approval-requests/${approvalRequest.id}`,
    process.env.APPROVAL_UI_BASE_URL ?? 'http://localhost:3000',
  );
  approvalUrl.searchParams.set('token', approvalAccessToken);

  console.log(`Seeded approval request: ${approvalRequest.id}`);
  console.log(`Approval URL: ${approvalUrl.toString()}`);
  console.log(`Sample approver user: ${approverUser.email} (${approverUser.displayName})`);
  console.log('Next step: open the approval URL, register a passkey for the sample approver, then authenticate and approve/reject.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
