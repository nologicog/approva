# Environment Reference

The public repository is documented around open-core self-host usage.

Reference templates:

- [../.env.example](../.env.example)
- [../apps/api/.env.example](../apps/api/.env.example)
- [../apps/approval-ui/.env.local.example](../apps/approval-ui/.env.local.example)
- [../deploy/env/open-core.self-host.root.env.example](../deploy/env/open-core.self-host.root.env.example)
- [../deploy/env/open-core.self-host.api.env.example](../deploy/env/open-core.self-host.api.env.example)
- [../deploy/env/open-core.self-host.ui.env.example](../deploy/env/open-core.self-host.ui.env.example)

## Root

Required:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/approva?schema=public
AUTHON_RUNTIME_MODE=open-core
AUTHON_SELF_HOST_MODE=true
AUTHON_DEFAULT_ORGANIZATION_NAME="Default Organization"
AUTHON_DEFAULT_ORGANIZATION_SLUG=default
```

## API

Required:

```bash
PORT=4000
APPROVAL_UI_BASE_URL=http://localhost:3000
APPROVAL_ACCESS_TOKEN_SECRET=change-me-approval-access
WEBHOOK_SIGNING_SECRET=change-me-webhook
PASSKEY_RP_NAME=Approva
PASSKEY_RP_ID=localhost
PASSKEY_EXPECTED_ORIGINS=http://localhost:3000
```

Useful optional settings:

- `AUTHON_API_ALLOWED_ORIGINS`
- `AUTHON_RATE_LIMIT_*`
- `AUTHON_INTEGRATION_ENCRYPTION_KEY`
- `AUTHON_EMAIL_FROM`
- `AUTHON_RESEND_API_KEY`
- `AUTHON_SLACK_BOT_TOKEN`
- `AUTHON_SLACK_CHANNEL_ID`
- `AUTHON_SENTRY_DSN`

## UI

Required:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
AUTHON_RUNTIME_MODE=open-core
AUTHON_SELF_HOST_MODE=true
```

Useful optional settings:

- `AUTHON_INTERNAL_API_BASE_URL`
- `NEXT_PUBLIC_SAMPLE_APPROVER_EMAIL`
- `NEXT_PUBLIC_APPROVA_RELEASE`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ID` and `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTHON_EMAIL_FROM`
- `AUTHON_RESEND_API_KEY`

## Notes

- Open-core is the default runtime when no valid mode is configured.
- Optional dashboard auth is separate from approval auth.
- For non-localhost deployments, set final HTTPS origins before testing passkeys.
