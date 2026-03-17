import type { Organization, OrganizationMembership, OrganizationMemberRole } from '@approva/shared';
import { prisma } from '@/lib/dashboard-auth/prisma';
import {
  getDefaultOrganizationName,
  getDefaultOrganizationSlug,
  isOpenCoreRuntimeMode,
} from '@/lib/runtime-mode';

type DashboardUserContext = {
  activeOrganization: Organization | null;
  memberships: OrganizationMembership[];
  needsOnboarding: boolean;
};

const ROLE_PRIORITY: OrganizationMemberRole[] = ['owner', 'admin', 'member', 'approver'];

export async function ensureDashboardUserOrganizationContext(
  userId: string,
): Promise<DashboardUserContext | null> {
  const existingUser = await loadDashboardUser(userId);

  if (!existingUser) {
    return null;
  }

  if (existingUser.email) {
    await acceptPendingOrganizationInvitations(existingUser);
  }

  const resolvedUser = (await loadDashboardUser(userId)) ?? existingUser;

  if (resolvedUser.memberships.length === 0) {
    await provisionInitialOrganization(resolvedUser);
  } else if (
    !resolvedUser.activeOrganizationId ||
    !resolvedUser.memberships.some(
      (membership) => membership.organizationId === resolvedUser.activeOrganizationId,
    )
  ) {
    const preferredMembership = selectPreferredMembership(resolvedUser.memberships);

    await prisma.user.update({
      where: {
        id: resolvedUser.id,
      },
      data: {
        activeOrganizationId: preferredMembership.organizationId,
      },
    });
  }

  return getDashboardUserOrganizationContext(userId);
}

export async function switchDashboardUserOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
    },
  });

  if (!membership) {
    throw new Error('You are not a member of that organization.');
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      activeOrganizationId: organizationId,
    },
  });

  return getDashboardUserOrganizationContext(userId);
}

export async function getDashboardUserOrganizationContext(
  userId: string,
): Promise<DashboardUserContext | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      activeOrganizationId: true,
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const memberships = user.memberships.map((membership) => ({
    id: membership.id,
    userId,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
            organization: {
              id: membership.organization.id,
              name: membership.organization.name,
              slug: membership.organization.slug,
              createdAt: membership.organization.createdAt.toISOString(),
              ownerUserId: membership.organization.ownerUserId,
              onboardingCompletedAt:
                membership.organization.onboardingCompletedAt?.toISOString() ?? null,
            },
          }));

  const activeMembership =
    memberships.find((membership) => membership.organization.id === user.activeOrganizationId) ??
    memberships[0] ??
    null;

  return {
    activeOrganization: activeMembership?.organization ?? null,
    memberships,
    needsOnboarding:
      activeMembership?.role === 'owner' &&
      !activeMembership.organization.onboardingCompletedAt,
  };
}

async function loadDashboardUser(userId: string) {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      activeOrganizationId: true,
      memberships: {
        include: {
          organization: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
}

async function acceptPendingOrganizationInvitations(user: {
  id: string;
  email: string | null;
}) {
  const email = normalizeEmail(user.email);

  if (!email) {
    return;
  }

  const now = new Date();
  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      email,
      acceptedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
    },
  });

  if (invitations.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const invitation of invitations) {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
      });

      await tx.organizationInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          acceptedAt: now,
        },
      });
    }

    const dashboardUser = await tx.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        activeOrganizationId: true,
      },
    });

    if (!dashboardUser?.activeOrganizationId) {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          activeOrganizationId: invitations[0].organizationId,
        },
      });
    }
  });
}

async function provisionInitialOrganization(user: {
  id: string;
  name: string | null;
  email: string | null;
}) {
  if (isOpenCoreRuntimeMode()) {
    const defaultOrganization = await prisma.organization.upsert({
      where: {
        slug: getDefaultOrganizationSlug(),
      },
      update: {
        name: getDefaultOrganizationName(),
        onboardingCompletedAt: new Date(),
      },
      create: {
        name: getDefaultOrganizationName(),
        slug: getDefaultOrganizationSlug(),
        onboardingCompletedAt: new Date(),
      },
      select: {
        id: true,
        ownerUserId: true,
      },
    });

    const role: OrganizationMemberRole = defaultOrganization.ownerUserId ? 'admin' : 'owner';

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.create({
        data: {
          organizationId: defaultOrganization.id,
          userId: user.id,
          role,
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          activeOrganizationId: defaultOrganization.id,
        },
      });

      if (!defaultOrganization.ownerUserId) {
        await tx.organization.update({
          where: {
            id: defaultOrganization.id,
          },
          data: {
            ownerUserId: user.id,
          },
        });
      }
    });

    return;
  }

  const organizationName = buildInitialOrganizationName(user);
  const organizationSlug = await buildUniqueOrganizationSlug(organizationName);

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: organizationSlug,
        ownerUserId: user.id,
      },
      select: {
        id: true,
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
      },
    });

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        activeOrganizationId: organization.id,
      },
    });
  });
}

function selectPreferredMembership(
  memberships: Array<{
    organizationId: string;
    role: OrganizationMemberRole;
  }>,
) {
  return memberships
    .slice()
    .sort(
      (left, right) =>
        ROLE_PRIORITY.indexOf(left.role) - ROLE_PRIORITY.indexOf(right.role),
    )[0];
}

async function buildUniqueOrganizationSlug(name: string) {
  const base = slugify(name) || `authon-${crypto.randomUUID().slice(0, 8)}`;
  let candidate = base;
  let index = 1;

  while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function buildInitialOrganizationName(user: { name: string | null; email: string | null }) {
  if (user.name?.trim()) {
    return `${user.name.trim()} Workspace`;
  }

  if (user.email?.trim()) {
    const localPart = user.email.split('@')[0]?.trim();

    if (localPart) {
      return `${localPart} Workspace`;
    }
  }

  return 'Approva Workspace';
}

function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
