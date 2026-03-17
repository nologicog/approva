import { Injectable } from '@nestjs/common';
import {
  getAuthonApiEnvironmentIssues,
  getAuthonIntegrationEncryptionKeyMaterial,
  getAuthonRuntimeMode,
  getConfiguredAuthonRuntimeMode,
  type AuthonRuntimeMode,
} from '@approva/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export type HealthCheckStatus = 'ok' | 'warn' | 'error' | 'skipped';
export type OverallHealthStatus = 'ok' | 'ready' | 'not_ready';

export interface HealthCheckResult {
  status: HealthCheckStatus;
  details: string;
  required: boolean;
  metadata?: Record<string, unknown>;
}

export interface OptionalProviderChecks {
  status: 'ok' | 'warn' | 'skipped';
  details: string;
  providers: {
    resend: HealthCheckResult;
    slack: HealthCheckResult;
  };
}

export interface LivenessResponse {
  status: OverallHealthStatus;
  runtimeMode: AuthonRuntimeMode;
  checks: {
    process: HealthCheckResult;
  };
  timestamp: string;
}

export interface ReadinessResponse {
  status: OverallHealthStatus;
  runtimeMode: AuthonRuntimeMode;
  checks: {
    runtimeMode: HealthCheckResult;
    config: HealthCheckResult;
    database: HealthCheckResult;
    encryption: HealthCheckResult;
    providers: OptionalProviderChecks;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      runtimeMode: getAuthonRuntimeMode(process.env),
      checks: {
        process: {
          status: 'ok',
          required: true,
          details: 'Approva API process is running.',
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const runtimeMode = getAuthonRuntimeMode(process.env);
    const runtimeModeCheck = this.getRuntimeModeCheck(runtimeMode);
    const configCheck = this.getConfigCheck();
    const databaseCheck = await this.getDatabaseCheck();
    const encryptionCheck = this.getEncryptionCheck(runtimeMode);
    const providersCheck = this.getOptionalProviderChecks(runtimeMode);

    const response: ReadinessResponse = {
      status:
        [runtimeModeCheck, configCheck, databaseCheck, encryptionCheck].some(
          (check) => check.status === 'error',
        )
          ? 'not_ready'
          : 'ready',
      runtimeMode,
      checks: {
        runtimeMode: runtimeModeCheck,
        config: configCheck,
        database: databaseCheck,
        encryption: encryptionCheck,
        providers: providersCheck,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      ok: response.status === 'ready',
      body: response,
    };
  }

  private getRuntimeModeCheck(runtimeMode: AuthonRuntimeMode): HealthCheckResult {
    const configuredRuntimeMode = getConfiguredAuthonRuntimeMode(process.env);

    if (
      configuredRuntimeMode &&
      configuredRuntimeMode !== 'open-core' &&
      configuredRuntimeMode !== 'cloud'
    ) {
      return {
        status: 'error',
        required: true,
        details: 'AUTHON_RUNTIME_MODE has an unsupported value.',
        metadata: {
          configuredRuntimeMode,
          resolvedRuntimeMode: runtimeMode,
        },
      };
    }

    return {
      status: 'ok',
      required: true,
      details: 'Runtime mode is valid.',
      metadata: {
        configuredRuntimeMode: configuredRuntimeMode ?? null,
        resolvedRuntimeMode: runtimeMode,
      },
    };
  }

  private getConfigCheck(): HealthCheckResult {
    const issues = getAuthonApiEnvironmentIssues(process.env).filter(
      (issue) => issue.name !== 'AUTHON_RUNTIME_MODE',
    );

    if (issues.length > 0) {
      return {
        status: 'error',
        required: true,
        details: 'API startup configuration is incomplete or invalid.',
        metadata: {
          issues,
        },
      };
    }

    return {
      status: 'ok',
      required: true,
      details: 'API startup configuration is loaded and valid.',
    };
  }

  private async getDatabaseCheck(): Promise<HealthCheckResult> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        status: 'ok',
        required: true,
        details: 'Database connection check succeeded.',
      };
    } catch (error) {
      return {
        status: 'error',
        required: true,
        details: 'Database connection check failed.',
        metadata: {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : {
                  message: 'Unknown database error.',
                },
        },
      };
    }
  }

  private getEncryptionCheck(runtimeMode: AuthonRuntimeMode): HealthCheckResult {
    const configuredKey = process.env.AUTHON_INTEGRATION_ENCRYPTION_KEY?.trim() ?? null;
    const keyMaterial = getAuthonIntegrationEncryptionKeyMaterial(configuredKey);

    if (runtimeMode === 'cloud') {
      if (!configuredKey) {
        return {
          status: 'error',
          required: true,
          details: 'Integration encryption key is required in cloud mode.',
        };
      }

      if (!keyMaterial) {
        return {
          status: 'error',
          required: true,
          details:
            'Integration encryption key is present but malformed. Expected 32-byte base64 or 64-character hex.',
        };
      }

      return {
        status: 'ok',
        required: true,
        details: 'Integration encryption key is available.',
      };
    }

    if (!configuredKey) {
      return {
        status: 'skipped',
        required: false,
        details: 'Integration encryption key is optional in open-core mode.',
      };
    }

    if (!keyMaterial) {
      return {
        status: 'warn',
        required: false,
        details:
          'Integration encryption key is configured but malformed. Secret-backed integrations may fail until it is corrected.',
      };
    }

    return {
      status: 'ok',
      required: false,
      details: 'Integration encryption key is configured.',
    };
  }

  private getOptionalProviderChecks(
    runtimeMode: AuthonRuntimeMode,
  ): OptionalProviderChecks {
    const resendConfigured = Boolean(
      process.env.AUTHON_RESEND_API_KEY?.trim() &&
        (process.env.AUTHON_EMAIL_FROM?.trim() || process.env.AUTH_EMAIL_FROM?.trim()),
    );
    const slackConfigured = Boolean(
      process.env.AUTHON_SLACK_BOT_TOKEN?.trim() &&
        process.env.AUTHON_SLACK_CHANNEL_ID?.trim(),
    );
    const resend = this.createProviderCheck(
      runtimeMode,
      resendConfigured,
      'Resend email delivery is configured.',
      'Resend is not fully configured. Email delivery will fall back to local logging or remain unavailable.',
    );
    const slack = this.createProviderCheck(
      runtimeMode,
      slackConfigured,
      'Slack fallback delivery is configured.',
      'Slack fallback delivery is not configured. Organization-scoped Slack integrations may still work if configured in the product.',
    );
    const providerStatuses = [resend.status, slack.status];
    const overallStatus = providerStatuses.every((status) => status === 'skipped')
      ? 'skipped'
      : providerStatuses.some((status) => status === 'warn')
        ? 'warn'
        : 'ok';

    return {
      status: overallStatus,
      details:
        overallStatus === 'ok'
          ? 'Optional providers are configured.'
          : overallStatus === 'skipped'
            ? 'Optional providers are skipped in open-core mode unless explicitly configured.'
            : 'Some optional providers are not configured. Core readiness is unaffected.',
      providers: {
        resend,
        slack,
      },
    };
  }

  private createProviderCheck(
    runtimeMode: AuthonRuntimeMode,
    configured: boolean,
    configuredDetails: string,
    missingDetails: string,
  ): HealthCheckResult {
    if (configured) {
      return {
        status: 'ok',
        required: false,
        details: configuredDetails,
      };
    }

    if (runtimeMode === 'open-core') {
      return {
        status: 'skipped',
        required: false,
        details: 'Optional in open-core mode.',
      };
    }

    return {
      status: 'warn',
      required: false,
      details: missingDetails,
    };
  }
}
