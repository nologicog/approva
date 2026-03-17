import { LegalPage } from '@/components/legal-page';

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Approva Terms"
      intro="Minimal draft terms page for self-hosted Approva deployments."
      sections={[
        {
          heading: 'Open-core scope',
          body: (
            <p>
              Approva Open Core is provided as self-hostable software. Features, APIs, and
              operational behavior may change as the open-core edition evolves.
            </p>
          ),
        },
        {
          heading: 'Customer responsibility',
          body: (
            <>
              <p>
                Customers remain responsible for the actions their agents or automations request,
                the destinations they connect to, and the policies they choose to enforce around
                risky actions.
              </p>
              <p>
                Approva provides approval controls, capability binding, and event-chain recording,
                but does not guarantee the correctness of third-party systems or user-configured
                automation logic.
              </p>
            </>
          ),
        },
        {
          heading: 'Draft status',
          body: (
            <p>
              These terms are a placeholder and should be replaced with reviewed legal terms before
              production use.
            </p>
          ),
        },
      ]}
    />
  );
}
