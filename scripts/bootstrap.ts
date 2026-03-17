#!/usr/bin/env tsx

import { PrismaClient, ApiKeyScope as PrismaApiKeyScope } from '@prisma/client';
import { getAuthonRuntimeMode } from '../packages/config/src/index';
import {
  generateOpaqueToken,
  hashTokenValue,
} from '../apps/api/src/common/utils/hash.util';
import { encryptApplicationValue } from '../apps/api/src/common/utils/application-encryption.util';

type BootstrapOptions = {
  organizationName?: string;
  organizationSlug?: string;
  ownerEmail?: string;
  createServiceAccount: boolean;
  serviceAccountName: string;
  serviceAccountDescription?: string;
  createApiKey: boolean;
  apiKeyName: string;
  apiKeyScopes: PrismaApiKeyScope[];
  emailRecipients: string[];
  slackChannelId?: string;
  slackBotToken?: string;
  webhookUrl?: string;
  webhookSecret?: string;
};

type BootstrapSummary = {
  runtimeMode: 'open-core' | 'cloud';
  organization: {
    id: string;
    name: string;
    slug: string;
    ownerUserId: string | null;
  } | null;
  ownerUser: {
    id: string;
    email: string;
    attached: boolean;
    note?: string;
  } | null;
  policyStatus: 'created' | 'existing' | 'skipped';
  serviceAccount: {
    id: string;
    name: string;
    created: boolean;
  } | null;
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    rawKey: string | null;
    created: boolean;
    note?: string;
  } | null;
  integrations: Array<{
    type: 'email' | 'slack' | 'webhook';
    status: 'created' | 'updated' | 'skipped';
    note?: string;
  }>;
  nextSteps: string[];
};

const prisma = new PrismaClient();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtimeMode = getAuthonRuntimeMode();
  const summary: BootstrapSummary = {
    runtimeMode,
    organization: null,
    ownerUser: null,
    policyStatus: 'skipped',
    serviceAccount: null,
    apiKey: null,
    integrations: [],
    nextSteps: [],
  };

  try {
    const organization = await resolveBootstrapOrganization(options, runtimeMode, summary);
    summary.organization = organization
      ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          ownerUserId: organization.ownerUserId,
        }
      : null;

    if (!organization) {
      printSummary(summary);
      return;
    }

    await attachOwnerIfPossible(organization.id, options.ownerEmail, summary);
    summary.organization = await prisma.organization.findUnique({
      where: {
        id: organization.id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerUserId: true,
      },
    });
    await ensureDefaultPoliciesIfNoneExist(organization.id, summary);

    const serviceAccount = await maybeCreateServiceAccount(
      organization.id,
      summary.ownerUser?.attached ? summary.ownerUser.id : null,
      options,
      summary,
    );

    await maybeCreateApiKey(
      organization.id,
      serviceAccount?.id ?? null,
      summary.ownerUser?.attached ? summary.ownerUser.id : null,
      options,
      summary,
    );

    await maybeConfigureIntegrations(organization.id, options, summary);
    populateNextSteps(summary, options);
    printSummary(summary);
  } finally {
    await prisma.$disconnect();
  }
}

async function resolveBootstrapOrganization(
  options: BootstrapOptions,
  runtimeMode: 'open-core' | 'cloud',
  summary: BootstrapSummary,
) {
  if (runtimeMode === 'open-core') {
    const slug = options.organizationSlug || getDefaultOrganizationSlug();
    const name = options.organizationName || getDefaultOrganizationName();
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
        ownerUserId: true,
      },
    });

    return organization;
  }

  const requestedSlug =
    normalizeOptionalString(options.organizationSlug) ||
    slugify(options.organizationName ?? '');
  const requestedName = normalizeOptionalString(options.organizationName);

  if (requestedSlug) {
    const existing = await prisma.organization.findUnique({
      where: {
        slug: requestedSlug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerUserId: true,
      },
    });

    if (existing) {
      if (requestedName && existing.name !== requestedName) {
        return prisma.organization.update({
          where: {
            id: existing.id,
          },
          data: {
            name: requestedName,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            ownerUserId: true,
          },
        });
      }

      return existing;
    }
  }

  const existingOrganizations = await prisma.organization.count();

  if (!requestedName) {
    summary.nextSteps.push(
      'No organization was created in AUTHON_RUNTIME_MODE=cloud because no --organization-name was provided.',
    );
    summary.nextSteps.push(
      'If you are using the compatibility cloud mode, sign in once through /sign-in to let Approva provision the first owner organization automatically, or rerun bootstrap with --organization-name and --owner-email for a known dashboard user.',
    );
    if (existingOrganizations > 0) {
      summary.nextSteps.push(
        'You can also rerun bootstrap with --organization-slug to target an existing organization.',
      );
    }
    return null;
  }

  const ownerUser = await findDashboardUserByEmail(options.ownerEmail);

  if (!ownerUser) {
    summary.ownerUser = options.ownerEmail
      ? {
          id: '',
          email: options.ownerEmail,
          attached: false,
          note:
            'Owner email was not found as a dashboard user. Sign in once through /sign-in with that email, then rerun bootstrap to attach ownership safely.',
        }
      : null;
    summary.nextSteps.push(
      'Cloud bootstrap did not create a new organization because no existing dashboard user was available to own it safely.',
    );
    summary.nextSteps.push(
      'Sign in once through /sign-in with the intended owner email, then rerun bootstrap with --organization-name and --owner-email.',
    );
    return null;
  }

  const slug = requestedSlug || slugify(requestedName);

  return prisma.organization.create({
    data: {
      name: requestedName,
      slug,
      ownerUserId: ownerUser.id,
      onboardingCompletedAt: new Date(),
      members: {
        create: {
          userId: ownerUser.id,
          role: 'owner',
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerUserId: true,
    },
  });
}

async function attachOwnerIfPossible(
  organizationId: string,
  ownerEmail: string | undefined,
  summary: BootstrapSummary,
) {
  const normalizedEmail = normalizeEmail(ownerEmail);

  if (!normalizedEmail) {
    return;
  }

  const ownerUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      activeOrganizationId: true,
    },
  });

  if (!ownerUser) {
    summary.ownerUser = {
      id: '',
      email: normalizedEmail,
      attached: false,
      note:
        'The owner email is not yet a dashboard user. Sign in once through /sign-in, then rerun bootstrap to attach ownership.',
    };
    return;
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      ownerUserId: true,
      slug: true,
      name: true,
    },
  });

  if (organization.ownerUserId && organization.ownerUserId !== ownerUser.id) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: ownerUser.id,
        },
      },
      update: {},
      create: {
        organizationId,
        userId: ownerUser.id,
        role: 'admin',
      },
    });

    if (!ownerUser.activeOrganizationId) {
      await prisma.user.update({
        where: {
          id: ownerUser.id,
        },
        data: {
          activeOrganizationId: organizationId,
        },
      });
    }

    summary.ownerUser = {
      id: ownerUser.id,
      email: ownerUser.email ?? normalizedEmail,
      attached: false,
      note:
        'This organization already has an owner. The requested user was attached as an admin instead of replacing ownership.',
    };
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: ownerUser.id,
        },
      },
      update: {
        role: 'owner',
      },
      create: {
        organizationId,
        userId: ownerUser.id,
        role: 'owner',
      },
    });

    await tx.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        ownerUserId: ownerUser.id,
      },
    });

    if (!ownerUser.activeOrganizationId) {
      await tx.user.update({
        where: {
          id: ownerUser.id,
        },
        data: {
          activeOrganizationId: organizationId,
        },
      });
    }
  });

  summary.ownerUser = {
    id: ownerUser.id,
    email: ownerUser.email ?? normalizedEmail,
    attached: true,
  };
}

async function ensureDefaultPoliciesIfNoneExist(
  organizationId: string,
  summary: BootstrapSummary,
) {
  const existingCount = await prisma.policy.count({
    where: {
      organizationId,
    },
  });

  if (existingCount > 0) {
    summary.policyStatus = 'existing';
    return;
  }

  await prisma.policy.createMany({
    data: [
      {
        organizationId,
        action: '*',
        resourceType: '*',
        riskLevel: 'high',
        approvalRequired: true,
        approverRoles: ['owner', 'admin', 'approver'],
      },
      {
        organizationId,
        action: '*',
        resourceType: '*',
        riskLevel: 'critical',
        approvalRequired: true,
        approverRoles: ['owner', 'admin', 'approver'],
      },
    ],
  });

  summary.policyStatus = 'created';
}

async function maybeCreateServiceAccount(
  organizationId: string,
  createdByUserId: string | null,
  options: BootstrapOptions,
  summary: BootstrapSummary,
) {
  const shouldCreate = options.createServiceAccount || options.createApiKey;

  if (!shouldCreate) {
    return null;
  }

  const existing = await prisma.serviceAccount.findFirst({
    where: {
      organizationId,
      name: options.serviceAccountName,
      revokedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existing) {
    summary.serviceAccount = {
      id: existing.id,
      name: existing.name,
      created: false,
    };
    return existing;
  }

  const serviceAccount = await prisma.serviceAccount.create({
    data: {
      organizationId,
      name: options.serviceAccountName,
      description: normalizeOptionalString(options.serviceAccountDescription),
      createdByUserId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  summary.serviceAccount = {
    id: serviceAccount.id,
    name: serviceAccount.name,
    created: true,
  };

  return serviceAccount;
}

async function maybeCreateApiKey(
  organizationId: string,
  serviceAccountId: string | null,
  createdByUserId: string | null,
  options: BootstrapOptions,
  summary: BootstrapSummary,
) {
  if (!options.createApiKey) {
    return;
  }

  const existing = await prisma.organizationApiKey.findFirst({
    where: {
      organizationId,
      name: options.apiKeyName,
      revokedAt: null,
    },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existing) {
    summary.apiKey = {
      id: existing.id,
      name: existing.name,
      keyPrefix: existing.keyPrefix,
      rawKey: null,
      created: false,
      note:
        'An active API key with this name already exists. Approva will not reveal its raw value again.',
    };
    return;
  }

  const rawKey = generateOpaqueToken({
    prefix: 'authon_sk',
    randomLength: 32,
  });

  const apiKey = await prisma.organizationApiKey.create({
    data: {
      organizationId,
      serviceAccountId,
      name: options.apiKeyName,
      keyPrefix: rawKey.slice(0, Math.min(rawKey.length, 22)),
      keyHash: hashTokenValue(rawKey),
      scopes: options.apiKeyScopes,
      createdByUserId,
    },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
    },
  });

  summary.apiKey = {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    rawKey,
    created: true,
  };
}

async function maybeConfigureIntegrations(
  organizationId: string,
  options: BootstrapOptions,
  summary: BootstrapSummary,
) {
  if (options.emailRecipients.length > 0) {
    const existing = await prisma.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId,
          type: 'email',
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.integration.upsert({
      where: {
        organizationId_type: {
          organizationId,
          type: 'email',
        },
      },
      update: {
        configJson: {
          recipients: options.emailRecipients,
        },
      },
      create: {
        organizationId,
        type: 'email',
        configJson: {
          recipients: options.emailRecipients,
        },
      },
    });

    summary.integrations.push({
      type: 'email',
      status: existing ? 'updated' : 'created',
    });
  } else {
    summary.integrations.push({
      type: 'email',
      status: 'skipped',
      note: 'No email recipients were provided.',
    });
  }

  if (options.slackChannelId && options.slackBotToken) {
    const encryptedToken = encryptApplicationValue(options.slackBotToken);
    const existing = await prisma.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId,
          type: 'slack',
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.integration.upsert({
      where: {
        organizationId_type: {
          organizationId,
          type: 'slack',
        },
      },
      update: {
        configJson: {
          channelId: options.slackChannelId,
          botTokenEncrypted: encryptedToken,
          botTokenMasked: maskSecret(options.slackBotToken),
        },
      },
      create: {
        organizationId,
        type: 'slack',
        configJson: {
          channelId: options.slackChannelId,
          botTokenEncrypted: encryptedToken,
          botTokenMasked: maskSecret(options.slackBotToken),
        },
      },
    });

    summary.integrations.push({
      type: 'slack',
      status: existing ? 'updated' : 'created',
    });
  } else {
    summary.integrations.push({
      type: 'slack',
      status: 'skipped',
      note:
        'Slack bootstrap requires both --slack-channel-id and --slack-bot-token. No Slack integration was written.',
    });
  }

  if (options.webhookUrl && options.webhookSecret) {
    const encryptedSecret = encryptApplicationValue(options.webhookSecret);
    const existing = await prisma.integration.findUnique({
      where: {
        organizationId_type: {
          organizationId,
          type: 'webhook',
        },
      },
      select: {
        id: true,
      },
    });

    await prisma.integration.upsert({
      where: {
        organizationId_type: {
          organizationId,
          type: 'webhook',
        },
      },
      update: {
        configJson: {
          url: options.webhookUrl,
          secretEncrypted: encryptedSecret,
          secretMasked: maskSecret(options.webhookSecret),
        },
      },
      create: {
        organizationId,
        type: 'webhook',
        configJson: {
          url: options.webhookUrl,
          secretEncrypted: encryptedSecret,
          secretMasked: maskSecret(options.webhookSecret),
        },
      },
    });

    summary.integrations.push({
      type: 'webhook',
      status: existing ? 'updated' : 'created',
    });
  } else {
    summary.integrations.push({
      type: 'webhook',
      status: 'skipped',
      note:
        'Webhook bootstrap requires both --webhook-url and --webhook-secret. No webhook integration was written.',
    });
  }
}

function populateNextSteps(summary: BootstrapSummary, options: BootstrapOptions) {
  const uiBaseUrl = getUiBaseUrl();

  if (summary.runtimeMode === 'cloud') {
    if (summary.organization && summary.ownerUser?.attached) {
      summary.nextSteps.push(
        `Sign in through ${uiBaseUrl}/sign-in with ${summary.ownerUser.email} and confirm ${uiBaseUrl}/console/approvals loads against ${summary.organization.slug}.`,
      );
    } else if (summary.organization && !summary.ownerUser?.attached) {
      summary.nextSteps.push(
        `An AUTHON_RUNTIME_MODE=cloud organization exists, but first owner attachment is still manual. Sign in through ${uiBaseUrl}/sign-in, then rerun bootstrap with --owner-email if needed.`,
      );
    }
  } else {
    summary.nextSteps.push(
      `Open ${uiBaseUrl}/console/approvals to confirm the default organization console is available.`,
    );
  }

  if (summary.policyStatus === 'created') {
    summary.nextSteps.push(
      'Open /console/policies to review the default high-risk and critical-risk approval policies.',
    );
  }

  if (!options.createApiKey) {
    summary.nextSteps.push(
      'If you want a machine-ready path immediately, rerun bootstrap with --create-service-account --create-api-key.',
    );
  }
}

function printSummary(summary: BootstrapSummary) {
  console.log('Approva bootstrap summary');
  console.log(`Runtime mode: ${summary.runtimeMode}`);
  console.log('');

  if (summary.organization) {
    console.log(`Organization: ${summary.organization.name} (${summary.organization.slug})`);
    console.log(`Organization ID: ${summary.organization.id}`);
  } else {
    console.log('Organization: not created');
  }

  console.log(`Policies: ${summary.policyStatus}`);

  if (summary.ownerUser) {
    console.log('');
    console.log(`Owner email: ${summary.ownerUser.email}`);
    console.log(`Owner attached: ${summary.ownerUser.attached ? 'yes' : 'no'}`);
    if (summary.ownerUser.note) {
      console.log(`Owner note: ${summary.ownerUser.note}`);
    }
  }

  if (summary.serviceAccount) {
    console.log('');
    console.log(
      `Service account: ${summary.serviceAccount.name} (${summary.serviceAccount.created ? 'created' : 'existing'})`,
    );
  }

  if (summary.apiKey) {
    console.log('');
    console.log(`API key: ${summary.apiKey.name} (${summary.apiKey.created ? 'created' : 'existing'})`);
    console.log(`API key prefix: ${summary.apiKey.keyPrefix}`);
    if (summary.apiKey.note) {
      console.log(`API key note: ${summary.apiKey.note}`);
    }
    if (summary.apiKey.rawKey) {
      console.log('');
      console.log('Raw API key');
      console.log(summary.apiKey.rawKey);
      console.log('');
      console.log('Store this now. Approva will not reveal it again.');
    }
  }

  console.log('');
  console.log('Integrations');
  for (const integration of summary.integrations) {
    const suffix = integration.note ? ` - ${integration.note}` : '';
    console.log(`- ${integration.type}: ${integration.status}${suffix}`);
  }

  if (summary.nextSteps.length > 0) {
    console.log('');
    console.log('Next steps');
    for (const step of summary.nextSteps) {
      console.log(`- ${step}`);
    }
  }
}

function parseArgs(argv: string[]): BootstrapOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const flags = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const [name, inlineValue] = token.split('=', 2);

    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
      continue;
    }

    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      flags.set(name, true);
      continue;
    }

    flags.set(name, next);
    index += 1;
  }

  return {
    organizationName: readStringFlag(flags, '--organization-name'),
    organizationSlug: readStringFlag(flags, '--organization-slug'),
    ownerEmail: readStringFlag(flags, '--owner-email'),
    createServiceAccount: Boolean(flags.get('--create-service-account')),
    serviceAccountName:
      readStringFlag(flags, '--service-account-name') ?? 'Bootstrap Agent',
    serviceAccountDescription:
      readStringFlag(flags, '--service-account-description') ??
      'Created by the Approva bootstrap script.',
    createApiKey: Boolean(flags.get('--create-api-key')),
    apiKeyName: readStringFlag(flags, '--api-key-name') ?? 'Bootstrap Agent Key',
    apiKeyScopes: parseApiKeyScopes(readStringFlag(flags, '--api-key-scopes')),
    emailRecipients: parseCsv(readStringFlag(flags, '--email-recipients')),
    slackChannelId: readStringFlag(flags, '--slack-channel-id'),
    slackBotToken: readStringFlag(flags, '--slack-bot-token'),
    webhookUrl: readStringFlag(flags, '--webhook-url'),
    webhookSecret: readStringFlag(flags, '--webhook-secret'),
  };
}

function parseApiKeyScopes(rawValue?: string) {
  const defaults: PrismaApiKeyScope[] = [
    'approval_requests_create',
    'approval_requests_read',
    'capabilities_verify',
    'capabilities_use',
  ];

  if (!rawValue) {
    return defaults;
  }

  const mapping: Record<string, PrismaApiKeyScope> = {
    'approval_requests:create': 'approval_requests_create',
    'approval_requests:read': 'approval_requests_read',
    'capabilities:verify': 'capabilities_verify',
    'capabilities:use': 'capabilities_use',
    'webhooks:manage': 'webhooks_manage',
  };

  return parseCsv(rawValue).map((scope) => {
    const mapped = mapping[scope];

    if (!mapped) {
      throw new Error(`Unsupported API key scope: ${scope}`);
    }

    return mapped;
  });
}

function printHelp() {
  console.log(`Approva bootstrap

Usage:
  pnpm bootstrap -- [options]

Options:
  --organization-name <name>         Create or target an organization by name
  --organization-slug <slug>         Target a specific organization slug
  --owner-email <email>              Attach a known dashboard user as owner when possible
  --create-service-account           Create or reuse a bootstrap service account
  --service-account-name <name>      Service account name (default: Bootstrap Agent)
  --create-api-key                   Create or reuse a machine API key
  --api-key-name <name>              API key name (default: Bootstrap Agent Key)
  --api-key-scopes <csv>             Comma-separated scopes
  --email-recipients <csv>           Create/update email integration recipients
  --slack-channel-id <id>            Create/update Slack integration if paired with bot token
  --slack-bot-token <token>          Slack bot token to encrypt and store
  --webhook-url <url>                Create/update webhook integration if paired with secret
  --webhook-secret <secret>          Webhook secret to encrypt and store
  --help                             Show this help
`);
}

function readStringFlag(flags: Map<string, string | true>, name: string) {
  const value = flags.get(name);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseCsv(rawValue?: string) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function findDashboardUserByEmail(email?: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
    },
  });
}

function getDefaultOrganizationName() {
  return normalizeOptionalString(process.env.AUTHON_DEFAULT_ORGANIZATION_NAME) || 'Default Organization';
}

function getDefaultOrganizationSlug() {
  return normalizeOptionalString(process.env.AUTHON_DEFAULT_ORGANIZATION_SLUG) || 'default';
}

function getUiBaseUrl() {
  return (
    normalizeOptionalString(process.env.AUTH_URL) ||
    normalizeOptionalString(process.env.APPROVAL_UI_BASE_URL) ||
    'http://localhost:3000'
  );
}

function slugify(input: string) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'authon-org';
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeEmail(value?: string | null) {
  return normalizeOptionalString(value)?.toLowerCase() ?? null;
}

function maskSecret(secret: string) {
  const normalized = secret.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`;
  }

  return `${normalized.slice(0, 4)}***${normalized.slice(-4)}`;
}

main().catch((error) => {
  console.error(
    error instanceof Error ? `Bootstrap failed: ${error.message}` : 'Bootstrap failed.',
  );
  process.exit(1);
});
