'use client';

import { FormEvent, useEffect, useState } from 'react';
import type {
  InternalLedgerVerificationResult,
  OrganizationMemberRole,
} from '@approva/shared';
import { verifyConsoleLedger } from '@/lib/console-api';

function formatRangeLabel(fromSeq: string, toSeq: string) {
  if (fromSeq && toSeq) {
    return `Sequences ${fromSeq} to ${toSeq}`;
  }

  if (fromSeq) {
    return `From sequence ${fromSeq}`;
  }

  if (toSeq) {
    return `Up to sequence ${toSeq}`;
  }

  return 'Full chain';
}

export function ConsoleLedgerPage({
  canVerifyLedger,
  activeRole,
  initialFromSeq,
  initialToSeq,
}: {
  canVerifyLedger: boolean;
  activeRole: OrganizationMemberRole | null;
  initialFromSeq?: string | null;
  initialToSeq?: string | null;
}) {
  const [fromSeq, setFromSeq] = useState(initialFromSeq ?? '');
  const [toSeq, setToSeq] = useState(initialToSeq ?? '');
  const [result, setResult] = useState<InternalLedgerVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (nextFromSeq: string, nextToSeq: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await verifyConsoleLedger({
        fromSeq: nextFromSeq ? Number(nextFromSeq) : undefined,
        toSeq: nextToSeq ? Number(nextToSeq) : undefined,
      });
      setResult(response);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Failed to verify the ledger chain.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canVerifyLedger) {
      return;
    }

    void verify(initialFromSeq ?? '', initialToSeq ?? '');
  }, [canVerifyLedger, initialFromSeq, initialToSeq]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await verify(fromSeq, toSeq);
  };

  return (
    <main className="console-stack">
      <section className="card stack">
        <div>
          <div className="label">Ledger verification</div>
          <h2>Verify the deterministic hash chain</h2>
        </div>
        <p>
          Internal/admin-facing integrity check over the full ledger or a bounded sequence range.
        </p>

        {!canVerifyLedger ? (
          <div className="empty">
            Your role is <span className="mono">{activeRole ?? 'unknown'}</span>. Ledger
            verification is limited to organization owners and admins.
          </div>
        ) : (
          <form className="console-filter-grid narrow" onSubmit={handleSubmit}>
            <label className="field">
              <span>From sequence</span>
              <input
                inputMode="numeric"
                min="1"
                onChange={(event) => setFromSeq(event.target.value)}
                placeholder="1"
                type="number"
                value={fromSeq}
              />
            </label>

            <label className="field">
              <span>To sequence</span>
              <input
                inputMode="numeric"
                min="1"
                onChange={(event) => setToSeq(event.target.value)}
                placeholder="42"
                type="number"
                value={toSeq}
              />
            </label>

            <div className="console-filter-actions">
              <button className="button primary" disabled={loading} type="submit">
                {loading ? 'Verifying...' : 'Verify ledger'}
              </button>
            </div>
          </form>
        )}
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="card stack">
        <div className="console-section-header">
          <div>
            <div className="label">Verification result</div>
            <h2>{formatRangeLabel(fromSeq, toSeq)}</h2>
          </div>
          {result ? (
            <div className={`status ${result.valid ? 'approved' : 'rejected'}`}>
              {result.valid ? 'valid' : 'invalid'}
            </div>
          ) : null}
        </div>

        {!result && !loading && canVerifyLedger ? (
          <div className="empty">Run a verification to inspect the ledger chain.</div>
        ) : null}

        {result ? (
          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>Checked entries</span>
              <strong>{result.checkedEntries}</strong>
            </div>
            <div className="console-detail-item">
              <span>First invalid sequence</span>
              <strong>{result.firstInvalidSeq ?? 'None'}</strong>
            </div>
            <div className="console-detail-item">
              <span>Reason</span>
              <strong>{result.reason ?? 'No issues detected'}</strong>
            </div>
          </div>
        ) : null}

        <div className="empty">
          Local API path:
          <span className="mono"> POST /v1/internal/ledger/verify</span>
        </div>
      </section>
    </main>
  );
}
