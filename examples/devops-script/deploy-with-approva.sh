#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required."
  exit 1
fi

APPROVAL_RESPONSE_JSON="$(mktemp)"
STATUS_JSON="$(mktemp)"
trap 'rm -f "$APPROVAL_RESPONSE_JSON" "$STATUS_JSON"' EXIT

node packages/cli/dist/index.js approval request \
  --action deployment.execute \
  --resource-type service \
  --resource-id billing-api \
  --risk-level high \
  --requested-by-system devops-script \
  --requested-by-actor-id "shell-$(date +%s)" \
  --reason "Deploy build 2026.03.16 from the devops shell example" \
  --json > "$APPROVAL_RESPONSE_JSON"

APPROVAL_REQUEST_ID="$(jq -r '.request.id' "$APPROVAL_RESPONSE_JSON")"
APPROVAL_URL="$(jq -r '.approvalUrl // empty' "$APPROVAL_RESPONSE_JSON")"

echo "Approval requested: $APPROVAL_REQUEST_ID"
if [ -n "$APPROVAL_URL" ]; then
  echo "Approval URL: $APPROVAL_URL"
fi

while true; do
  node packages/cli/dist/index.js approval get "$APPROVAL_REQUEST_ID" --json > "$STATUS_JSON"
  STATUS="$(jq -r '.request.status' "$STATUS_JSON")"

  echo "Current status: $STATUS"

  if [ "$STATUS" = "approved" ] || [ "$STATUS" = "auto_approved" ]; then
    break
  fi

  if [ "$STATUS" = "rejected" ] || [ "$STATUS" = "expired" ]; then
    echo "Stopping because the request ended in status: $STATUS"
    exit 1
  fi

  sleep 5
done

if [ -z "${APPROVA_CAPABILITY_TOKEN:-}" ]; then
  echo "Approval granted, but APPROVA_CAPABILITY_TOKEN is not set."
  echo "This example is intentionally poll-based. For fully automated continuation, use a signed webhook with deliverCapabilityMode=exchange_token and exchange the one-time delivery token through /v1/capabilities/exchange."
  exit 0
fi

node packages/cli/dist/index.js capability use \
  --token "$APPROVA_CAPABILITY_TOKEN" \
  --action deployment.execute \
  --resource-type service \
  --resource-id billing-api \
  --params-json '{"environment":"production","version":"2026.03.16-demo","region":"eu-west-1","reason":"Deploy build 2026.03.16 from the devops shell example"}'

echo "Deployment executed."
