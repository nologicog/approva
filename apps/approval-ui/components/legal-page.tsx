import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';

interface LegalSection {
  heading: string;
  body: ReactNode;
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="shell legal-shell">
      <section className="hero legal-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>

      <section className="grid legal-grid">
        {sections.map((section) => (
          <article className="card stack" key={section.heading}>
            <div>
              <div className="label">{eyebrow}</div>
              <h2>{section.heading}</h2>
            </div>
            <div className="legal-copy">{section.body}</div>
          </article>
        ))}
      </section>

      <section className="card stack legal-note">
        <div>
          <div className="label">Note</div>
          <h2>Template content for self-hosted deployments</h2>
        </div>
        <p>
          These pages are intentionally minimal and should be reviewed and replaced with your own
          organization’s legal and security language before a production self-host deployment.
        </p>
        <div className="actions">
          <Link className="button ghost link-button" href="/">
            Back to landing
          </Link>
          <Link className="button primary link-button" href="/console/approvals">
            Open console
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
