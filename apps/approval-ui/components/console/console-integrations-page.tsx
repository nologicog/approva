'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  CreateIntegrationInput,
  EmailIntegrationConfig,
  IntegrationRecord,
  OrganizationMemberRole,
  SlackIntegrationConfig,
  WebhookIntegrationConfig,
} from '@approva/shared';
import {
  createConsoleIntegration,
  deleteConsoleIntegration,
  listConsoleIntegrations,
  updateConsoleIntegration,
} from '@/lib/console-api';

type SlackFormState = {
  botToken: string;
  channelId: string;
};

type WebhookFormState = {
  url: string;
  secret: string;
};

type EmailFormState = {
  recipients: string;
};

const DEFAULT_SLACK_FORM: SlackFormState = {
  botToken: '',
  channelId: '',
};

const DEFAULT_WEBHOOK_FORM: WebhookFormState = {
  url: '',
  secret: '',
};

const DEFAULT_EMAIL_FORM: EmailFormState = {
  recipients: '',
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

function getRecipientsInput(config?: EmailIntegrationConfig | null) {
  return config?.recipients.join(', ') ?? '';
}

function parseRecipients(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ConsoleIntegrationsPage({
  activeRole,
  canManageIntegrations,
}: {
  activeRole: OrganizationMemberRole | null;
  canManageIntegrations: boolean;
}) {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [slackForm, setSlackForm] = useState<SlackFormState>(DEFAULT_SLACK_FORM);
  const [webhookForm, setWebhookForm] = useState<WebhookFormState>(DEFAULT_WEBHOOK_FORM);
  const [emailForm, setEmailForm] = useState<EmailFormState>(DEFAULT_EMAIL_FORM);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<'slack' | 'webhook' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const integrationsByType = useMemo(() => {
    return {
      slack:
        integrations.find((integration) => integration.type === 'slack') ??
        null,
      webhook:
        integrations.find((integration) => integration.type === 'webhook') ??
        null,
      email:
        integrations.find((integration) => integration.type === 'email') ??
        null,
    };
  }, [integrations]);
  const slackConfig = integrationsByType.slack?.configJson as SlackIntegrationConfig | undefined;
  const webhookConfig =
    integrationsByType.webhook?.configJson as WebhookIntegrationConfig | undefined;
  const emailConfig = integrationsByType.email?.configJson as EmailIntegrationConfig | undefined;

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listConsoleIntegrations();
      setIntegrations(response.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load integrations.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
  }, []);

  useEffect(() => {
    setSlackForm({
      botToken: '',
      channelId: slackConfig?.channelId ?? '',
    });
    setWebhookForm({
      url: webhookConfig?.url ?? '',
      secret: '',
    });
    setEmailForm({
      recipients: getRecipientsInput(emailConfig),
    });
  }, [emailConfig, slackConfig, webhookConfig]);

  const upsertIntegration = async (type: 'slack' | 'webhook' | 'email', input: CreateIntegrationInput) => {
    setBusyType(type);
    setError(null);

    try {
      const existing = integrationsByType[type];

      if (existing) {
        await updateConsoleIntegration(existing.id, input);
      } else {
        await createConsoleIntegration(input);
      }

      await loadIntegrations();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to save integration.',
      );
    } finally {
      setBusyType(null);
    }
  };

  const removeIntegration = async (type: 'slack' | 'webhook' | 'email') => {
    const existing = integrationsByType[type];

    if (!existing) {
      return;
    }

    setBusyType(type);
    setError(null);

    try {
      await deleteConsoleIntegration(existing.id);
      await loadIntegrations();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete integration.',
      );
    } finally {
      setBusyType(null);
    }
  };

  const handleSlackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await upsertIntegration('slack', {
      type: 'slack',
      configJson: {
        botToken: slackForm.botToken.trim(),
        channelId: slackForm.channelId.trim(),
      },
    });
  };

  const handleWebhookSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await upsertIntegration('webhook', {
      type: 'webhook',
      configJson: {
        url: webhookForm.url.trim(),
        secret: webhookForm.secret.trim(),
      },
    });
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await upsertIntegration('email', {
      type: 'email',
      configJson: {
        recipients: parseRecipients(emailForm.recipients),
      },
    });
  };

  return (
    <main className="console-stack">
      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Organization notification channels</div>
            <h2>Integrations</h2>
          </div>
          <p className="helper">
            Configure Slack, webhook, and email destinations for the active organization. If an
            integration is not configured, Approva falls back to the older environment-level
            defaults when available.
          </p>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {loading ? <div className="empty">Loading integrations...</div> : null}
        {!canManageIntegrations ? (
          <div className="empty">
            Your role is <span className="mono">{activeRole ?? 'unknown'}</span>. Integration
            changes are limited to organization owners and admins.
          </div>
        ) : null}
        {!loading && integrations.length === 0 ? (
          <div className="empty stack">
            <div>No organization integrations are configured yet.</div>
            <div>
              That is fine for a first run. Approva can fall back to environment-level email and
              Slack settings while you decide which notification channels belong to this
              organization.
            </div>
            <div className="actions">
              <Link className="button ghost link-button" href="/help#self-host">
                Self-host notes
              </Link>
              <Link className="button ghost link-button" href="/help">
                Help hub
              </Link>
            </div>
          </div>
        ) : null}

        <div className="console-section-grid">
          <article className="console-list-card compact">
            <div className="console-list-row">
              <div>
                <div className="label">Slack</div>
                <div className="console-card-title">Approval notifications in Slack</div>
              </div>
              <div className={`status ${integrationsByType.slack ? 'approved' : 'expired'}`}>
                {integrationsByType.slack ? 'Connected' : 'Not configured'}
              </div>
            </div>

            <form className="console-stack" onSubmit={handleSlackSubmit}>
              <label className="field">
                <span>bot_token</span>
                <input
                  disabled={!canManageIntegrations}
                  onChange={(event) =>
                    setSlackForm((current) => ({
                      ...current,
                      botToken: event.target.value,
                    }))
                  }
                  placeholder={
                    slackConfig?.botTokenConfigured
                      ? 'Leave blank to keep the current bot token'
                      : 'xoxb-...'
                  }
                  value={slackForm.botToken}
                />
              </label>
              {slackConfig?.botTokenConfigured ? (
                <div className="helper">
                  Stored token: <span className="mono">{slackConfig.botTokenMasked ?? 'configured'}</span>.
                  Leave the field blank to keep it, or enter a new value to replace it.
                </div>
              ) : null}
              <label className="field">
                <span>channel_id</span>
                <input
                  disabled={!canManageIntegrations}
                  onChange={(event) =>
                    setSlackForm((current) => ({
                      ...current,
                      channelId: event.target.value,
                    }))
                  }
                  placeholder="C1234567890"
                  value={slackForm.channelId}
                />
              </label>
              <p className="helper">
                Used for approval requested, approved, rejected, and expired notifications for this
                organization.
              </p>
              {canManageIntegrations ? (
                <div className="actions">
                  <button className="button primary" disabled={busyType === 'slack'} type="submit">
                    {busyType === 'slack'
                      ? 'Saving...'
                      : integrationsByType.slack
                        ? 'Update Slack'
                        : 'Connect Slack'}
                  </button>
                  {integrationsByType.slack ? (
                    <button
                      className="button ghost"
                      disabled={busyType === 'slack'}
                      onClick={() => removeIntegration('slack')}
                      type="button"
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
              ) : null}
              {integrationsByType.slack ? (
                <div className="helper">
                  Configured {formatTimestamp(integrationsByType.slack.createdAt)}
                </div>
              ) : null}
            </form>
          </article>

          <article className="console-list-card compact">
            <div className="console-list-row">
              <div>
                <div className="label">Webhook</div>
                <div className="console-card-title">Outcome notifications via signed webhook</div>
              </div>
              <div className={`status ${integrationsByType.webhook ? 'approved' : 'expired'}`}>
                {integrationsByType.webhook ? 'Configured' : 'Not configured'}
              </div>
            </div>

            <form className="console-stack" onSubmit={handleWebhookSubmit}>
              <label className="field">
                <span>url</span>
                <input
                  disabled={!canManageIntegrations}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://example.com/authon/webhook"
                  value={webhookForm.url}
                />
              </label>
              <label className="field">
                <span>secret</span>
                <input
                  disabled={!canManageIntegrations}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,
                      secret: event.target.value,
                    }))
                  }
                  placeholder={
                    webhookConfig?.secretConfigured
                      ? 'Leave blank to keep the current webhook secret'
                      : 'whsec_...'
                  }
                  value={webhookForm.secret}
                />
              </label>
              {webhookConfig?.secretConfigured ? (
                <div className="helper">
                  Stored secret: <span className="mono">{webhookConfig.secretMasked ?? 'configured'}</span>.
                  Leave the field blank to keep it, or enter a new value to replace it.
                </div>
              ) : null}
              <p className="helper">
                Approva signs organization-level notification webhooks. This is separate from any
                per-request callback URL.
              </p>
              {canManageIntegrations ? (
                <div className="actions">
                  <button className="button primary" disabled={busyType === 'webhook'} type="submit">
                    {busyType === 'webhook'
                      ? 'Saving...'
                      : integrationsByType.webhook
                        ? 'Update webhook'
                        : 'Configure webhook'}
                  </button>
                  {integrationsByType.webhook ? (
                    <button
                      className="button ghost"
                      disabled={busyType === 'webhook'}
                      onClick={() => removeIntegration('webhook')}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
              {integrationsByType.webhook ? (
                <div className="helper">
                  Configured {formatTimestamp(integrationsByType.webhook.createdAt)}
                </div>
              ) : null}
            </form>
          </article>

          <article className="console-list-card compact">
            <div className="console-list-row">
              <div>
                <div className="label">Email</div>
                <div className="console-card-title">Approval notification recipients</div>
              </div>
              <div className={`status ${integrationsByType.email ? 'approved' : 'expired'}`}>
                {integrationsByType.email ? 'Configured' : 'Not configured'}
              </div>
            </div>

            <form className="console-stack" onSubmit={handleEmailSubmit}>
              <label className="field">
                <span>recipients</span>
                <textarea
                  disabled={!canManageIntegrations}
                  onChange={(event) =>
                    setEmailForm({
                      recipients: event.target.value,
                    })
                  }
                  placeholder="approver@example.com, ops@example.com"
                  value={emailForm.recipients}
                />
              </label>
              <p className="helper">
                Comma-separated recipients for approval notification emails in this organization.
              </p>
              {canManageIntegrations ? (
                <div className="actions">
                  <button className="button primary" disabled={busyType === 'email'} type="submit">
                    {busyType === 'email'
                      ? 'Saving...'
                      : integrationsByType.email
                        ? 'Update recipients'
                        : 'Configure email'}
                  </button>
                  {integrationsByType.email ? (
                    <button
                      className="button ghost"
                      disabled={busyType === 'email'}
                      onClick={() => removeIntegration('email')}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
              {integrationsByType.email ? (
                <div className="helper">
                  Configured {formatTimestamp(integrationsByType.email.createdAt)}
                </div>
              ) : null}
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
