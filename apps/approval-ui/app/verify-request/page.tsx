import Link from 'next/link';

export default function VerifyRequestPage() {
  return (
    <main className="shell auth-shell">
      <section className="auth-grid single">
        <article className="card stack">
          <div>
            <span className="eyebrow">Approva</span>
            <h1 className="auth-title">Check your email</h1>
          </div>

          <p>
            A sign-in link was sent for your dashboard session. Open the email and follow the
            magic link to continue into the Approva console.
          </p>

          <div className="empty">
            Local development note: if email delivery is not configured, the magic link is logged
            in the Next.js server output.
          </div>

          <div className="actions">
            <Link className="button ghost link-button" href="/sign-in">
              Back to sign in
            </Link>
            <Link className="button primary link-button" href="/console/approvals">
              Go to console
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
