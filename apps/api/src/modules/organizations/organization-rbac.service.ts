import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  ApproverAuthorizationSummary,
  OrganizationMemberRole,
  OrganizationPermission,
} from '@approva/shared';
import { hasOrganizationPermission } from '@approva/shared';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isOpenCoreRuntimeMode } from '../../common/utils/runtime-mode.util';
import {
  type OrganizationContextInput,
  OrganizationsService,
} from './organizations.service';

export interface AuthorizedOrganizationMember {
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
}

@Injectable()
export class OrganizationRbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async requirePermission(
    permission: OrganizationPermission,
    organizationInput: OrganizationContextInput,
    dashboardUserId?: string | null,
    prisma: PrismaDbClient = this.prisma,
  ): Promise<AuthorizedOrganizationMember> {
    const userId = this.normalizeOptionalString(dashboardUserId);
    const organization = await this.organizationsService.resolveOrganization(
      organizationInput,
      prisma,
    );

    if (!userId) {
      if (isOpenCoreRuntimeMode()) {
        return {
          organizationId: organization.id,
          userId: 'open-core-operator',
          role: 'owner',
        };
      }

      throw new ForbiddenException('Dashboard membership context is required.');
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: organization.id,
        userId,
      },
      select: {
        organizationId: true,
        userId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization.');
    }

    if (!hasOrganizationPermission(membership.role, permission)) {
      throw new ForbiddenException(
        `Role ${membership.role} does not have permission for ${permission}.`,
      );
    }

    return membership;
  }

  async requireApproverRole(
    organizationId: string,
    approverEmail: string,
    allowedRoles: OrganizationMemberRole[],
    prisma: PrismaDbClient = this.prisma,
  ) {
    const authorization = await this.getApproverAuthorization(
      organizationId,
      approverEmail,
      allowedRoles,
      prisma,
    );

    if (!authorization.authorized) {
      throw new ForbiddenException(authorization.message);
    }

    return {
      role: authorization.approverRole!,
      userId: authorization.userId!,
    };
  }

  async getApproverAuthorization(
    organizationId: string,
    approverEmail: string | null | undefined,
    allowedRoles: OrganizationMemberRole[],
    prisma: PrismaDbClient = this.prisma,
  ): Promise<
    ApproverAuthorizationSummary & {
      userId?: string | null;
    }
  > {
    const email = this.normalizeOptionalString(approverEmail)?.toLowerCase() ?? null;

    if (!email) {
      return {
        authorized: false,
        code: 'approver_email_missing',
        message: 'Approver email is missing from the passkey-authenticated session.',
        allowedRoles,
        approverEmail: null,
        approverRole: null,
        userId: null,
      };
    }

    if (allowedRoles.length === 0) {
      return {
        authorized: false,
        code: 'no_allowed_roles_configured',
        message: 'No approver roles are configured for the matched policy on this request.',
        allowedRoles,
        approverEmail: email,
        approverRole: null,
        userId: null,
      };
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: {
          email,
        },
      },
      select: {
        role: true,
        userId: true,
      },
    });

    if (!membership) {
      return {
        authorized: false,
        code: 'not_member_of_organization',
        message:
          'You are not authorized to approve this request because your approver identity is not a member of this organization.',
        allowedRoles,
        approverEmail: email,
        approverRole: null,
        userId: null,
      };
    }

    if (!allowedRoles.includes(membership.role)) {
      return {
        authorized: false,
        code: 'role_not_allowed',
        message: `You are not authorized to approve this request. Allowed roles: ${allowedRoles.join(', ')}.`,
        allowedRoles,
        approverEmail: email,
        approverRole: membership.role,
        userId: membership.userId,
      };
    }

    return {
      authorized: true,
      code: 'authorized',
      message: 'This approver is authorized for the matched policy roles on this request.',
      allowedRoles,
      approverEmail: email,
      approverRole: membership.role,
      userId: membership.userId,
    };
  }

  private normalizeOptionalString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
