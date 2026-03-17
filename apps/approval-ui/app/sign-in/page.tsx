import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { getDashboardAuthProviderDescriptors } from '@/lib/dashboard-auth/providers';
import { isOpenCoreRuntimeMode } from '@/lib/runtime-mode';
import { SiteFooter } from '@/components/site-footer';

interface SignInPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  value: string | string[] | undefined,
  fallback: string,
) {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function formatError(error?: string) {
  switch (error) {
    case 'OAuthSignin':
    case 'OAuthCallbackError':
      return 'The provider sign-in flow could not be completed.';
    case 'AccessDenied':
      return 'Dashboard access was denied by the provider.';
    case 'Verification':
      return 'The magic link is invalid or has already been used.';
    default:
      return error ? 'Sign-in failed. Try again.' : null;
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  if (isOpenCoreRuntimeMode()) {
    redirect('/console/approvals');
  }

  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const callbackUrl = readSearchParam(
    resolvedSearchParams?.callbackUrl,
    '/console/approvals',
  );
  const error = formatError(readSearchParam(resolvedSearchParams?.error, ''));

  if (session?.user) {
    redirect(callbackUrl);
  }

  const providers = getDashboardAuthProviderDescriptors();

  async function signInWithProvider(formData: FormData) {
    'use server';

    const provider = formData.get('provider');
    const redirectTo = formData.get('callbackUrl');

    if (typeof provider !== 'string') {
      throw new Error('Provider is required.');
    }

    await signIn(provider, {
      redirectTo: typeof redirectTo === 'string' ? redirectTo : '/console/approvals',
    });
  }

  async function signInWithEmail(formData: FormData) {
    'use server';

    const email = formData.get('email');
    const redirectTo = formData.get('callbackUrl');

    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new Error('Email is required.');
    }

    await signIn('email', {
      email: email.trim(),
      redirectTo: typeof redirectTo === 'string' ? redirectTo : '/console/approvals',
    });
  }

  return (
    <main className="shell auth-shell">
      <section className="auth-grid">
        <article className="card stack">
          <div>
            <span className="eyebrow">Approva</span>
            <h1 className="auth-title">Sign in to the optional operator dashboard</h1>
          </div>

          <p>
            Open-core mode does not require dashboard auth, but this route remains available for
            self-host deployments that want an authenticated console session.
          </p>

          {error ? <div className="error">{error}</div> : null}

          <div className="auth-provider-list">
            {providers
              .filter((provider) => provider.type === 'oauth')
              .map((provider) => (
                <form action={signInWithProvider} key={provider.id}>
                  <input name="provider" type="hidden" value={provider.id} />
                  <input name="callbackUrl" type="hidden" value={callbackUrl} />
                  <button
                    className="button primary auth-provider-button"
                    disabled={!provider.enabled}
                    type="submit"
                  >
                    Continue with {provider.label}
                  </button>
                  <p className="helper">
                    {provider.enabled
                      ? provider.description
                      : `${provider.label} is not configured in local env yet.`}
                  </p>
                </form>
              ))}
          </div>

          <div className="auth-divider">
            <span>Email magic link</span>
          </div>

          <form action={signInWithEmail} className="stack">
            <input name="callbackUrl" type="hidden" value={callbackUrl} />
            <label className="field">
              <span>Work email</span>
              <input
                autoComplete="email"
                defaultValue=""
                name="email"
                placeholder="operator@example.com"
                type="email"
              />
            </label>
            <button className="button primary" type="submit">
              Send magic link
            </button>
            <p className="helper">
              When Resend is not configured locally, Approva logs the magic link to the Next.js
              server console instead of sending email.
            </p>
          </form>
        </article>

        <aside className="card stack">
          <div>
            <div className="label">Auth domains</div>
            <h2>Dashboard auth stays separate from approval auth</h2>
          </div>

          <div className="console-detail-list">
            <div className="console-detail-item">
              <span>Dashboard auth</span>
              <strong>GitHub, Google, Microsoft, email magic link</strong>
            </div>
            <div className="console-detail-item">
              <span>Used for</span>
              <strong>Optional console access</strong>
            </div>
            <div className="console-detail-item">
              <span>Approval auth</span>
              <strong>Approval access token + passkey approver session</strong>
            </div>
          </div>

          <div className="empty">
            Approval request pages such as
            <span className="mono"> /approval-requests/&lt;id&gt;</span> do not require dashboard
            login and continue to use the secure approval flow.
          </div>

          <Link className="button ghost link-button" href="/">
            Back to landing
          </Link>
          <Link className="button ghost link-button" href="/help#self-host">
            Self-host guide
          </Link>
          <Link className="button ghost link-button" href="/help">
            Help hub
          </Link>
        </aside>
      </section>

      <SiteFooter />
    </main>
  );
}
