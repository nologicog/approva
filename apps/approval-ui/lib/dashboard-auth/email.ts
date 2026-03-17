import {
  buildDashboardMagicLinkEmail,
  createTransactionalEmailProvider,
  TransactionalEmailClient,
} from '@approva/email';

interface SendDashboardMagicLinkInput {
  email: string;
  url: string;
  from: string;
}

export async function sendDashboardMagicLink({
  email,
  url,
  from,
}: SendDashboardMagicLinkInput) {
  const template = buildDashboardMagicLinkEmail({
    signInUrl: url,
    productName: 'Approva',
  });
  const client = new TransactionalEmailClient(
    createTransactionalEmailProvider({
      resendApiKey: process.env.AUTHON_RESEND_API_KEY ?? process.env.AUTH_RESEND_API_KEY,
      logger: (message) => console.info(message),
    }),
  );

  await client.send({
    from,
    to: [email],
    subject: template.subject,
    html: template.html,
    text: template.text,
    replyTo: process.env.AUTHON_EMAIL_REPLY_TO,
    tags: [
      {
        name: 'template',
        value: 'dashboard_magic_link',
      },
    ],
  });
}
