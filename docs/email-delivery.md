# Approva Email Delivery

Approva uses a shared transactional email layer so the open-core runtime does not need separate
email implementations for approvals and optional dashboard auth.

## What It Covers

- dashboard sign-in magic links
- approval notification emails

## Provider

The initial provider is Resend.

Provider-specific HTTP delivery is isolated behind the shared package in:

- [packages/email/src/index.ts](../packages/email/src/index.ts)

That package contains:

- the delivery provider abstraction
- the Resend provider
- the console/log fallback provider
- the current HTML/text templates

## Where Templates Live

Current templates are exported from:

- [packages/email/src/index.ts](../packages/email/src/index.ts)

Templates currently implemented:

- `buildDashboardMagicLinkEmail()`
- `buildApprovalNotificationEmail()`

## Trigger Points

Current live trigger points:

- dashboard magic link:
  [apps/approval-ui/lib/dashboard-auth/email.ts](../apps/approval-ui/lib/dashboard-auth/email.ts)
- approval notification:
  [apps/api/src/modules/notification/notification.service.ts](../apps/api/src/modules/notification/notification.service.ts)

## Required Env Vars

For real email delivery:

- `AUTHON_EMAIL_FROM`
- `AUTHON_RESEND_API_KEY`

Optional:

- `AUTHON_EMAIL_REPLY_TO`
- `AUTHON_APPROVAL_NOTIFICATION_TO`

Dashboard OAuth env vars remain separate and are documented in the main README.

## Resend Domain Verification

Before production delivery will work, the sender domain for `AUTHON_EMAIL_FROM` must be verified in Resend.

Example:

```bash
AUTHON_EMAIL_FROM="Approva <no-reply@updates.yourdomain.com>"
```

## Local Development Behavior

If `AUTHON_RESEND_API_KEY` is not configured:

- dashboard magic links are logged to the Next.js server console
- approval notification emails are logged to the NestJS API console

This fallback is intentional for local development and self-host trials.

## Approval Notification Recipients

Approval notification delivery is enabled when `AUTHON_APPROVAL_NOTIFICATION_TO` is set.

Use a comma-separated list:

```bash
AUTHON_APPROVAL_NOTIFICATION_TO=approver@example.com,ops@example.com
```

When a high-risk request becomes `pending`, Approva sends an email containing:

- action
- resource
- reason
- risk level
- approval link
