import Email from 'next-auth/providers/email';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import type { Provider } from 'next-auth/providers';
import { sendDashboardMagicLink } from '@/lib/dashboard-auth/email';

export interface DashboardProviderDescriptor {
  id: 'github' | 'google' | 'microsoft-entra-id' | 'email';
  label: string;
  type: 'oauth' | 'email';
  enabled: boolean;
  description: string;
}

const DEFAULT_EMAIL_FROM = 'Approva <no-reply@approva.local>';
const DEFAULT_EMAIL_SERVER = {
  host: 'localhost',
  port: 1025,
  auth: {
    user: 'authon',
    pass: 'authon',
  },
};

export function getDashboardAuthProviderDescriptors(): DashboardProviderDescriptor[] {
  return [
    {
      id: 'github',
      label: 'GitHub',
      type: 'oauth',
      enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
      description: 'Sign in with your GitHub identity.',
    },
    {
      id: 'google',
      label: 'Google',
      type: 'oauth',
      enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
      description: 'Sign in with Google for the optional dashboard.',
    },
    {
      id: 'microsoft-entra-id',
      label: 'Microsoft',
      type: 'oauth',
      enabled: Boolean(
        process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
          process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      ),
      description: 'Sign in with Microsoft Entra ID.',
    },
    {
      id: 'email',
      label: 'Email magic link',
      type: 'email',
      enabled: true,
      description:
        (process.env.AUTHON_RESEND_API_KEY || process.env.AUTH_RESEND_API_KEY) &&
        (process.env.AUTHON_EMAIL_FROM || process.env.AUTH_EMAIL_FROM)
          ? 'Email a magic link using Resend.'
          : 'Logs a magic link locally when Resend is not configured.',
    },
  ];
}

export function buildDashboardAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  if (
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
  ) {
    providers.push(
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      }),
    );
  }

  providers.push(
    Email({
      from:
        process.env.AUTHON_EMAIL_FROM ??
        process.env.AUTH_EMAIL_FROM ??
        DEFAULT_EMAIL_FROM,
      // Auth.js Email provider still expects a transport definition even when delivery is
      // overridden below. This placeholder keeps local builds stable while actual delivery
      // happens through Resend or the logged-link dev fallback.
      server: DEFAULT_EMAIL_SERVER,
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, provider }) {
        await sendDashboardMagicLink({
          email: identifier,
          url,
          from:
            provider.from ??
            process.env.AUTHON_EMAIL_FROM ??
            process.env.AUTH_EMAIL_FROM ??
            DEFAULT_EMAIL_FROM,
        });
      },
    }),
  );

  return providers;
}
