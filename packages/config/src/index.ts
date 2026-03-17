export type AuthonRuntimeMode = 'open-core' | 'cloud';

type EnvRecord = Record<string, string | undefined>;

export interface AuthonEnvironmentValidationIssue {
  name: string;
  message: string;
}

export class AuthonEnvironmentValidationError extends Error {
  constructor(
    readonly app: 'api' | 'approval-ui',
    readonly runtimeMode: AuthonRuntimeMode,
    readonly issues: AuthonEnvironmentValidationIssue[],
  ) {
    super(buildValidationMessage(app, runtimeMode, issues));
    this.name = 'AuthonEnvironmentValidationError';
  }
}

export function getAuthonRuntimeMode(env: EnvRecord = process.env): AuthonRuntimeMode {
  const configured = getConfiguredAuthonRuntimeMode(env);

  if (configured === 'open-core' || configured === 'cloud') {
    return configured;
  }

  if (normalizeOptionalString(env.AUTHON_SELF_HOST_MODE) === 'true') {
    return 'open-core';
  }

  return 'open-core';
}

export function isOpenCoreRuntimeMode(env: EnvRecord = process.env) {
  return getAuthonRuntimeMode(env) === 'open-core';
}

export function isCloudRuntimeMode(env: EnvRecord = process.env) {
  return getAuthonRuntimeMode(env) === 'cloud';
}

export function getConfiguredAuthonRuntimeMode(env: EnvRecord = process.env) {
  return normalizeOptionalString(env.AUTHON_RUNTIME_MODE);
}

export function getAuthonApiEnvironmentIssues(env: EnvRecord = process.env) {
  const runtimeMode = getAuthonRuntimeMode(env);
  const issues: AuthonEnvironmentValidationIssue[] = [
    ...getRuntimeModeIssues(env),
  ];

  requireEnv(env, issues, 'DATABASE_URL', 'Database connection is required.');

  if (runtimeMode === 'cloud') {
    requireEnv(
      env,
      issues,
      'AUTHON_INTEGRATION_ENCRYPTION_KEY',
      'Cloud mode requires application-level integration secret encryption.',
    );
    validateEncryptionKey(
      env.AUTHON_INTEGRATION_ENCRYPTION_KEY,
      issues,
      'AUTHON_INTEGRATION_ENCRYPTION_KEY',
    );
    requireEnv(
      env,
      issues,
      'WEBHOOK_SIGNING_SECRET',
      'Cloud mode requires webhook signing to be configured.',
    );
  }

  return issues;
}

export function validateAuthonApiEnvironment(env: EnvRecord = process.env) {
  const runtimeMode = getAuthonRuntimeMode(env);
  const issues = getAuthonApiEnvironmentIssues(env);

  if (issues.length > 0) {
    throw new AuthonEnvironmentValidationError('api', runtimeMode, issues);
  }

  return env;
}

export function getAuthonUiEnvironmentIssues(env: EnvRecord = process.env) {
  const runtimeMode = getAuthonRuntimeMode(env);
  const issues: AuthonEnvironmentValidationIssue[] = [
    ...getRuntimeModeIssues(env),
  ];

  if (runtimeMode === 'cloud') {
    requireEnv(env, issues, 'DATABASE_URL', 'Dashboard auth storage requires Postgres.');
    requireEnv(
      env,
      issues,
      'AUTH_SECRET',
      'Cloud mode requires Auth.js session signing.',
    );

    if (!hasConfiguredOAuthProvider(env)) {
      issues.push({
        name: 'OAUTH_PROVIDER',
        message:
          'Cloud mode requires at least one OAuth provider configuration: GitHub, Google, or Microsoft Entra ID.',
      });
    }

    if (!hasEmailSender(env)) {
      issues.push({
        name: 'AUTHON_EMAIL_FROM',
        message:
          'Cloud mode requires an email sender address for magic links and notifications.',
      });
    }
  }

  return issues;
}

export function validateAuthonUiEnvironment(env: EnvRecord = process.env) {
  const runtimeMode = getAuthonRuntimeMode(env);
  const issues = getAuthonUiEnvironmentIssues(env);

  if (issues.length > 0) {
    throw new AuthonEnvironmentValidationError('approval-ui', runtimeMode, issues);
  }

  return env;
}

export function getOpenCoreDashboardAuthSecret(env: EnvRecord = process.env) {
  const configured = normalizeOptionalString(env.AUTH_SECRET);

  if (configured) {
    return configured;
  }

  if (isOpenCoreRuntimeMode(env)) {
    return 'authon-open-core-dashboard-secret';
  }

  return undefined;
}

export function getAuthonIntegrationEncryptionKeyMaterial(rawValue?: string | null) {
  const raw = normalizeOptionalString(rawValue);

  if (!raw) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const base64 = tryDecodeBase64(raw);
  return base64 ?? null;
}

function hasConfiguredOAuthProvider(env: EnvRecord) {
  return [
    ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'],
    ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
    ['AUTH_MICROSOFT_ENTRA_ID_ID', 'AUTH_MICROSOFT_ENTRA_ID_SECRET'],
  ].some(([idKey, secretKey]) => Boolean(normalizeOptionalString(env[idKey]) && normalizeOptionalString(env[secretKey])));
}

function hasEmailSender(env: EnvRecord) {
  return Boolean(
    normalizeOptionalString(env.AUTHON_EMAIL_FROM) ||
      normalizeOptionalString(env.AUTH_EMAIL_FROM),
  );
}

function getRuntimeModeIssues(env: EnvRecord) {
  const configured = getConfiguredAuthonRuntimeMode(env);

  if (!configured || configured === 'open-core' || configured === 'cloud') {
    return [];
  }

  return [
    {
      name: 'AUTHON_RUNTIME_MODE',
      message: 'AUTHON_RUNTIME_MODE must be either "open-core" or "cloud".',
    },
  ] satisfies AuthonEnvironmentValidationIssue[];
}

function requireEnv(
  env: EnvRecord,
  issues: AuthonEnvironmentValidationIssue[],
  name: string,
  message: string,
) {
  if (!normalizeOptionalString(env[name])) {
    issues.push({
      name,
      message,
    });
  }
}

function validateEncryptionKey(
  rawValue: string | undefined,
  issues: AuthonEnvironmentValidationIssue[],
  name: string,
) {
  if (!normalizeOptionalString(rawValue)) {
    return;
  }

  if (!getAuthonIntegrationEncryptionKeyMaterial(rawValue)) {
    issues.push({
      name,
      message: `${name} must be a 32-byte base64 or 64-character hex key.`,
    });
  }
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function tryDecodeBase64(value: string) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');
    const decoded = Buffer.from(padded, 'base64');

    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function buildValidationMessage(
  app: 'api' | 'approval-ui',
  runtimeMode: AuthonRuntimeMode,
  issues: AuthonEnvironmentValidationIssue[],
) {
  return [
    `[Approva Config] ${app} startup validation failed for ${runtimeMode} mode.`,
    ...issues.map((issue) => `- ${issue.name}: ${issue.message}`),
  ].join('\n');
}
