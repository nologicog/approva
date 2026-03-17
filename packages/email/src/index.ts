export interface TransactionalEmailMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Array<{
    name: string;
    value: string;
  }>;
}

export interface TransactionalEmailDeliveryReceipt {
  provider: 'resend' | 'console';
  externalId?: string;
}

export interface TransactionalEmailProvider {
  readonly kind: TransactionalEmailDeliveryReceipt['provider'];
  send(message: TransactionalEmailMessage): Promise<TransactionalEmailDeliveryReceipt>;
}

export interface CreateTransactionalEmailProviderOptions {
  resendApiKey?: string;
  resendApiBaseUrl?: string;
  fetcher?: typeof fetch;
  logger?: (message: string) => void;
}

interface TransactionalEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEmailShell(title: string, intro: string, body: string) {
  return `
    <div style="font-family: Avenir Next, Segoe UI, sans-serif; line-height: 1.6; color: #1f2421;">
      <h1 style="margin: 0 0 12px; font-size: 24px;">${escapeHtml(title)}</h1>
      <p style="margin: 0 0 18px; color: #55635a;">${escapeHtml(intro)}</p>
      ${body}
    </div>
  `;
}

function renderFacts(
  entries: Array<{
    label: string;
    value: string;
  }>,
) {
  return `
    <table style="border-collapse: collapse; width: 100%; margin: 0 0 20px;">
      <tbody>
        ${entries
          .map(
            (entry) => `
              <tr>
                <td style="padding: 8px 0; color: #55635a; vertical-align: top; width: 160px;">
                  ${escapeHtml(entry.label)}
                </td>
                <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">
                  ${escapeHtml(entry.value)}
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderPrimaryButton(url: string, label: string) {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label);

  return `
    <p style="margin: 0 0 24px;">
      <a href="${safeUrl}" style="background: #116466; color: #ffffff; padding: 12px 18px; border-radius: 999px; text-decoration: none; font-weight: 700;">
        ${safeLabel}
      </a>
    </p>
  `;
}

export function buildDashboardMagicLinkEmail(input: {
  signInUrl: string;
  productName?: string;
}): TransactionalEmailTemplate {
  const productName = input.productName ?? 'Approva';

  return {
    subject: `Sign in to ${productName}`,
    html: renderEmailShell(
      `Sign in to ${productName}`,
      'Use the link below to continue to the Approva dashboard.',
      `${renderPrimaryButton(input.signInUrl, 'Sign in to Approva')}
       <p style="margin: 0; color: #55635a;">If you did not request this email, you can ignore it.</p>`,
    ),
    text: `Sign in to ${productName}\n\nUse this link to continue:\n${input.signInUrl}\n\nIf you did not request this email, you can ignore it.`,
  };
}

export function buildApprovalNotificationEmail(input: {
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  riskLevel: string;
  approvalUrl: string;
  requestedBy?: string;
}): TransactionalEmailTemplate {
  const resource = `${input.resourceType}/${input.resourceId}`;

  return {
    subject: `Approval required: ${input.action} on ${resource}`,
    html: renderEmailShell(
      'Approval required',
      'A risky action is paused and waiting for a human decision.',
      `
        ${renderFacts([
          { label: 'Action', value: input.action },
          { label: 'Resource', value: resource },
          { label: 'Risk level', value: input.riskLevel },
          { label: 'Reason', value: input.reason },
          ...(input.requestedBy ? [{ label: 'Requested by', value: input.requestedBy }] : []),
        ])}
        ${renderPrimaryButton(input.approvalUrl, 'Review approval request')}
        <p style="margin: 0; color: #55635a;">Open the approval page, authenticate with your passkey, and record the decision.</p>
      `,
    ),
    text:
      `Approval required\n\n` +
      `Action: ${input.action}\n` +
      `Resource: ${resource}\n` +
      `Risk level: ${input.riskLevel}\n` +
      `Reason: ${input.reason}\n` +
      (input.requestedBy ? `Requested by: ${input.requestedBy}\n` : '') +
      `\nReview request: ${input.approvalUrl}\n`,
  };
}

export class ResendEmailProvider implements TransactionalEmailProvider {
  readonly kind = 'resend' as const;

  private readonly fetcher: typeof fetch;
  private readonly resendApiBaseUrl: string;

  constructor(
    private readonly options: {
      apiKey: string;
      fetcher?: typeof fetch;
      resendApiBaseUrl?: string;
    },
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.resendApiBaseUrl = options.resendApiBaseUrl ?? 'https://api.resend.com';
  }

  async send(
    message: TransactionalEmailMessage,
  ): Promise<TransactionalEmailDeliveryReceipt> {
    const response = await this.fetcher(`${this.resendApiBaseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        tags: message.tags,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend delivery failed: ${body}`);
    }

    const payload = (await response.json()) as { id?: string };

    return {
      provider: this.kind,
      externalId: payload.id,
    };
  }
}

export class ConsoleEmailProvider implements TransactionalEmailProvider {
  readonly kind = 'console' as const;

  constructor(
    private readonly options?: {
      logger?: (message: string) => void;
    },
  ) {}

  async send(
    message: TransactionalEmailMessage,
  ): Promise<TransactionalEmailDeliveryReceipt> {
    const log = this.options?.logger ?? console.info;

    log(
      `[Approva Email][console fallback]\n` +
        `To: ${message.to.join(', ')}\n` +
        `From: ${message.from}\n` +
        `Subject: ${message.subject}\n\n` +
        `${message.text}`,
    );

    return {
      provider: this.kind,
    };
  }
}

export function createTransactionalEmailProvider(
  options: CreateTransactionalEmailProviderOptions = {},
): TransactionalEmailProvider {
  if (options.resendApiKey) {
    return new ResendEmailProvider({
      apiKey: options.resendApiKey,
      fetcher: options.fetcher,
      resendApiBaseUrl: options.resendApiBaseUrl,
    });
  }

  return new ConsoleEmailProvider({
    logger: options.logger,
  });
}

export class TransactionalEmailClient {
  constructor(private readonly provider: TransactionalEmailProvider) {}

  async send(
    message: TransactionalEmailMessage,
  ): Promise<TransactionalEmailDeliveryReceipt> {
    return this.provider.send(message);
  }
}
