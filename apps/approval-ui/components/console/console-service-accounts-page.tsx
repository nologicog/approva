'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { OrganizationMemberRole, ServiceAccountRecord } from '@approva/shared';
import {
  createConsoleServiceAccount,
  listConsoleServiceAccounts,
  revokeConsoleServiceAccount,
} from '@/lib/console-api';

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function ConsoleServiceAccountsPage({
  activeRole,
  canManageServiceAccounts,
}: {
  activeRole: OrganizationMemberRole | null;
  canManageServiceAccounts: boolean;
}) {
  const [items, setItems] = useState<ServiceAccountRecord[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServiceAccounts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listConsoleServiceAccounts();
      setItems(response.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load service accounts.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageServiceAccounts) {
      setLoading(false);
      return;
    }

    void loadServiceAccounts();
  }, [canManageServiceAccounts]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createConsoleServiceAccount({
        name,
        description,
      });
      setName('');
      setDescription('');
      await loadServiceAccounts();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to create service account.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);

    try {
      await revokeConsoleServiceAccount(id);
      await loadServiceAccounts();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Failed to revoke service account.',
      );
    }
  };

  return (
    <main className="console-stack">
      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Machine identities</div>
            <h2>Service accounts</h2>
          </div>
          <p className="helper">
            Service accounts give agents and backend systems a durable identity inside the active
            organization. API keys can be attached to a service account so audit events read like a
            real operator story instead of an anonymous token use.
          </p>
        </div>

        {!canManageServiceAccounts ? (
          <div className="empty">
            Your role is <span className="mono">{activeRole ?? 'unknown'}</span>. Service account
            management is limited to organization owners and admins.
          </div>
        ) : (
          <form className="console-filter-grid" onSubmit={handleSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                onChange={(event) => setName(event.target.value)}
                placeholder="Deploy agent"
                value={name}
              />
            </label>

            <label className="field field-span-2">
              <span>Description</span>
              <input
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Used by CI/CD to request approvals and consume granted capabilities."
                value={description}
              />
            </label>

            <div className="console-filter-actions">
              <button className="button primary" disabled={submitting} type="submit">
                {submitting ? 'Creating...' : 'Create service account'}
              </button>
            </div>
          </form>
        )}

        {error ? <div className="error">{error}</div> : null}
      </section>

      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Current organization</div>
            <h2>{loading ? 'Loading...' : `${items.length} service account${items.length === 1 ? '' : 's'}`}</h2>
          </div>
          <p className="helper">Revoking a service account disables any attached API keys immediately.</p>
        </div>

        {loading ? <div className="empty">Loading service accounts...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="empty">
            No service accounts yet. Create one for a deploy agent, webhook processor, or backend
            integration that should act on behalf of this organization.
          </div>
        ) : null}

        {items.map((item) => (
          <article className="console-list-card compact" key={item.id}>
            <div className="console-list-row">
              <div>
                <div className="console-card-title">{item.name}</div>
                <p className="helper">{item.description || 'No description provided.'}</p>
              </div>
              <div className={`status ${item.revokedAt ? 'rejected' : 'approved'}`}>
                {item.revokedAt ? 'Revoked' : 'Active'}
              </div>
            </div>

            <div className="console-metadata-grid">
              <div>
                <span className="label">Service account id</span>
                <strong className="mono">{item.id}</strong>
              </div>
              <div>
                <span className="label">Created</span>
                <strong>{formatTimestamp(item.createdAt)}</strong>
              </div>
              <div>
                <span className="label">Revoked</span>
                <strong>{item.revokedAt ? formatTimestamp(item.revokedAt) : 'Not revoked'}</strong>
              </div>
            </div>

            {!item.revokedAt && canManageServiceAccounts ? (
              <div className="console-filter-actions">
                <button
                  className="button ghost"
                  onClick={() => void handleRevoke(item.id)}
                  type="button"
                >
                  Revoke service account
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
