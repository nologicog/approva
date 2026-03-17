import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CurrentOrganizationResponse,
  UpdateCurrentOrganizationInput,
} from '@approva/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PrismaDbClient } from '../../common/prisma/prisma.types';
import { RequestContextService } from '../../common/observability/request-context.service';

export interface OrganizationContextInput {
  organizationId?: string | null;
  organizationSlug?: string | null;
}

export interface ResolvedOrganizationContext {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async resolveOrganization(
    input: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ): Promise<ResolvedOrganizationContext> {
    const organizationId = this.normalizeOptionalString(input.organizationId);
    const organizationSlug = this.normalizeOptionalString(input.organizationSlug);

    if (!organizationId && !organizationSlug) {
      return this.ensureDefaultOrganization(prisma);
    }

    const organization = organizationId
      ? await prisma.organization.findUnique({
          where: {
            id: organizationId,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        })
      : await prisma.organization.findUnique({
          where: {
            slug: organizationSlug!,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    if (organizationId && organizationSlug && organization.slug !== organizationSlug) {
      throw new ConflictException('Organization id and slug refer to different organizations.');
    }

    this.requestContextService.setOrganizationId(organization.id);

    return organization;
  }

  async ensureDefaultOrganization(
    prisma: PrismaDbClient = this.prisma,
  ): Promise<ResolvedOrganizationContext> {
    const slug = this.getDefaultOrganizationSlug();
    const name = this.getDefaultOrganizationName();

    const organization = await prisma.organization.upsert({
      where: {
        slug,
      },
      update: {
        name,
        onboardingCompletedAt: new Date(),
      },
      create: {
        name,
        slug,
        onboardingCompletedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    this.requestContextService.setOrganizationId(organization.id);

    return organization;
  }

  async getCurrentOrganization(
    input: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ): Promise<CurrentOrganizationResponse> {
    const organization = await this.resolveOrganizationRecord(input, prisma);

    return {
      organization: this.toOrganizationRecord(organization),
    };
  }

  async updateCurrentOrganization(
    input: UpdateCurrentOrganizationInput,
    organizationInput: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ): Promise<CurrentOrganizationResponse> {
    const organization = await this.resolveOrganization(organizationInput, prisma);
    const name = this.normalizeOptionalString(input.name);

    if (!name) {
      throw new BadRequestException('Organization name is required.');
    }

    const updated = await prisma.organization.update({
      where: {
        id: organization.id,
      },
      data: {
        name,
        ...(input.completeOnboarding
          ? {
              onboardingCompletedAt: new Date(),
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        ownerUserId: true,
        onboardingCompletedAt: true,
      },
    });

    return {
      organization: this.toOrganizationRecord(updated),
    };
  }

  private async resolveOrganizationRecord(
    input: OrganizationContextInput = {},
    prisma: PrismaDbClient = this.prisma,
  ) {
    const organization = await this.resolveOrganization(input, prisma);

    return prisma.organization.findUniqueOrThrow({
      where: {
        id: organization.id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        ownerUserId: true,
        onboardingCompletedAt: true,
      },
    });
  }

  private toOrganizationRecord(organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    ownerUserId: string | null;
    onboardingCompletedAt: Date | null;
  }) {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt.toISOString(),
      ownerUserId: organization.ownerUserId,
      onboardingCompletedAt: organization.onboardingCompletedAt?.toISOString() ?? null,
    };
  }

  private getDefaultOrganizationSlug() {
    return (
      this.normalizeOptionalString(process.env.AUTHON_DEFAULT_ORGANIZATION_SLUG) ?? 'default'
    );
  }

  private getDefaultOrganizationName() {
    return (
      this.normalizeOptionalString(process.env.AUTHON_DEFAULT_ORGANIZATION_NAME) ??
      'Default Organization'
    );
  }

  private normalizeOptionalString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
