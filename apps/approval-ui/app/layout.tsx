import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Approva | Human approval for risky AI actions',
  description:
    'Approva is approval infrastructure for AI agents and automations. Pause risky actions, verify approvers with passkeys, issue scoped capabilities, and keep a full audit trail.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
