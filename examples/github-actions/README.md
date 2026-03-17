# GitHub Actions Example

This example shows how a CI workflow can request approval through Approva before a protected deployment step.

Files:

- [approva-approval.yml](./approva-approval.yml)

## What It Demonstrates

- machine-authenticated Approva CLI usage from a workflow runner
- high-risk deployment approval request creation
- request status polling
- conditional protected-action continuation after approval

## Required Secrets

- `APPROVA_BASE_URL`
- `APPROVA_API_KEY`
- optionally `APPROVA_CAPABILITY_TOKEN` if you already obtained a raw token through a valid exchange flow

## Continuation Note

This workflow is intentionally minimal and poll-based.

- it shows the approval checkpoint pattern clearly
- it does not implement a signed webhook receiver inside the workflow
- for fully automated continuation after approval, use Approva's signed webhook plus `exchange_token` delivery mode in a first-party service or runner

Canonical reference:

- [Agent Integration Guide](../../docs/agent-integration.md)
