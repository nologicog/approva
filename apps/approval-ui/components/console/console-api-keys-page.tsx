'use client';

import { FormEvent, useEffect, useState } from 'react';
import type {
  ApiKeyScope,
  CreateOrganizationApiKeyResponse,
  OrganizationApiKeyRecord,
  OrganizationMemberRole,
  ServiceAccountRecord,
} from '@approva/shared';
import {
  createConsoleApiKey,
  listConsoleApiKeys,
  listConsoleServiceAccounts,
  revokeConsoleApiKey,
} from '@/lib/console-api';

const API_KEY_SCOPES: Array<{
  value: ApiKeyScope;
  label: string;
}> = [
  {
    value: 'approval_requests:create',
    label: 'Create approval requests',
  },
  {
    value: 'approval_requests:read',
    label: 'Read approval requests',
  },
  {
    value: 'capabilities:verify',
    label: 'Verify capabilities',
  },
  {
    value: 'capabilities:use',
    label: 'Use capabilities',
  },
  {
    value: 'webhooks:manage',
    label: 'Manage webhooks',
  },
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function ConsoleApiKeysPage({
  activeRole,
  canManageApiKeys,
  canManageServiceAccounts,
}: {
  activeRole: OrganizationMemberRole | null;
  canManageApiKeys: boolean;
  canManageServiceAccounts: boolean;
}) {
  const [apiKeys, setApiKeys] = useState<OrganizationApiKeyRecord[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccountRecord[]>([]);
  const [name, setName] = useState('');
  const [serviceAccountId, setServiceAccountId] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([
    'approval_requests:create',
    'approval_requests:read',
    'capabilities:verify',
    'capabilities:use',
  ]);
  const [createdKey, setCreatedKey] = useState<CreateOrganizationApiKeyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [apiKeyResponse, serviceAccountResponse] = await Promise.all([
        listConsoleApiKeys(),
        listConsoleServiceAccounts(),
      ]);
      setApiKeys(apiKeyResponse.items);
      setServiceAccounts(serviceAccountResponse.items.filter((item) => !item.revokedAt));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load API keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageApiKeys) {
      setLoading(false);
      return;
    }

    void loadData();
  }, [canManageApiKeys]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreatedKey(null);

    try {
      const response = await createConsoleApiKey({
        name,
        serviceAccountId: serviceAccountId || undefined,
        scopes,
      });

      setCreatedKey(response);
      setName('');
      setServiceAccountId('');
      setScopes([
        'approval_requests:create',
        'approval_requests:read',
        'capabilities:verify',
        'capabilities:use',
      ]);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create API key.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScopeToggle = (scope: ApiKeyScope, checked: boolean) => {
    setScopes((current) =>
      checked ? [...current, scope] : current.filter((value) => value !== scope),
    );
  };

  const handleRevoke = async (id: string) => {
    setError(null);

    try {
      await revokeConsoleApiKey(id);
      await loadData();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke API key.');
    }
  };

  return (
    <main className="console-stack">
      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Machine authentication</div>
            <h2>Organization API keys</h2>
          </div>
          <p className="helper">
            API keys are organization-scoped bearer credentials for agents, scripts, CI/CD systems,
            and backend services. Raw keys are shown exactly once at creation time and are never
            stored in Approva in plaintext.
          </p>
        </div>

        {!canManageApiKeys ? (
          <div className="empty">
            Your role is <span className="mono">{activeRole ?? 'unknown'}</span>. API key
            management is limited to organization owners and admins.
          </div>
        ) : (
          <form className="console-stack" onSubmit={handleSubmit}>
            <div className="console-filter-grid">
              <label className="field">
                <span>Name</span>
                <input
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Deploy agent production key"
                  value={name}
                />
              </label>

              <label className="field">
                <span>Service account</span>
                <select
                  disabled={!canManageServiceAccounts && serviceAccounts.length === 0}
                  onChange={(event) => setServiceAccountId(event.target.value)}
                  value={serviceAccountId}
                >
                  <option value="">No service account</option>
                  {serviceAccounts.map((serviceAccount) => (
                    <option key={serviceAccount.id} value={serviceAccount.id}>
                      {serviceAccount.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field">
              <span>Scopes</span>
              <div className="checkbox-grid">
                {API_KEY_SCOPES.map((scope) => (
                  <label className="checkbox-chip" key={scope.value}>
                    <input
                      checked={scopes.includes(scope.value)}
                      onChange={(event) => handleScopeToggle(scope.value, event.target.checked)}
                      type="checkbox"
                    />
                    <span>{scope.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="console-filter-actions">
              <button className="button primary" disabled={submitting} type="submit">
                {submitting ? 'Creating...' : 'Create API key'}
              </button>
            </div>
          </form>
        )}

        {createdKey ? (
          <div className="empty">
            <strong>Copy this key now.</strong> Approva only shows it once.
            <div className="console-metadata-grid">
              <div>
                <span className="label">Key prefix</span>
                <strong className="mono">{createdKey.apiKey.keyPrefix}</strong>
              </div>
              <div>
                <span className="label">Raw API key</span>
                <strong className="mono">{createdKey.rawKey}</strong>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}
      </section>

      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Current organization</div>
            <h2>{loading ? 'Loading...' : `${apiKeys.length} API key${apiKeys.length === 1 ? '' : 's'}`}</h2>
          </div>
          <p className="helper">
            Attach keys to a service account when you want audit history to identify the calling
            machine actor cleanly.
          </p>
        </div>

        {loading ? <div className="empty">Loading API keys...</div> : null}
        {!loading && apiKeys.length === 0 ? (
          <div className="empty">
            No API keys yet. Create one to let a deploy agent or backend service call Approva
            without a dashboard session.
          </div>
        ) : null}

        {apiKeys.map((apiKey) => (
          <article className="console-list-card compact" key={apiKey.id}>
            <div className="console-list-row">
              <div>
                <div className="console-card-title">{apiKey.name}</div>
                <p className="helper">
                  {apiKey.serviceAccountName
                    ? `Attached to ${apiKey.serviceAccountName}`
                    : 'Not attached to a service account'}
                </p>
              </div>
              <div className={`status ${apiKey.revokedAt ? 'rejected' : 'approved'}`}>
                {apiKey.revokedAt ? 'Revoked' : 'Active'}
              </div>
            </div>

            <div className="console-metadata-grid">
              <div>
                <span className="label">Key prefix</span>
                <strong className="mono">{apiKey.keyPrefix}</strong>
              </div>
              <div>
                <span className="label">Scopes</span>
                <strong>{apiKey.scopes.join(', ')}</strong>
              </div>
              <div>
                <span className="label">Last used</span>
                <strong>{apiKey.lastUsedAt ? formatTimestamp(apiKey.lastUsedAt) : 'Never used'}</strong>
              </div>
              <div>
                <span className="label">Created</span>
                <strong>{formatTimestamp(apiKey.createdAt)}</strong>
              </div>
            </div>

            {!apiKey.revokedAt && canManageApiKeys ? (
              <div className="console-filter-actions">
                <button
                  className="button ghost"
                  onClick={() => void handleRevoke(apiKey.id)}
                  type="button"
                >
                  Revoke API key
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
