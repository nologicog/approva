# Examples

This directory contains runnable Approva integration examples and reference clients.

Quickstart:

1. Start Approva locally with `make dev` or `make start`.
2. Build the CLI with `pnpm cli:build` if the example uses it.
3. Export `APPROVA_BASE_URL` and `APPROVA_API_KEY`, then run an example.

Current examples:

- [node-deploy-agent](./node-deploy-agent)
  minimal backend/agent integration showing approval request creation, signed webhook handling, capability use, and simulated deployment execution
- [ai-agent](./ai-agent)
  canonical first-party agent example using the signed webhook + exchange-token continuation path
- [github-actions](./github-actions)
  workflow example showing how CI can request approval and gate a deployment on Approva
- [devops-script](./devops-script)
  shell-first approval gate for operators and scripts using the Approva CLI

Environment examples:

- [node-deploy-agent/.env.example](./node-deploy-agent/.env.example)

Related docs:

- [Docs index](../docs/README.md)
- [Agent Integration Guide](../docs/agent-integration.md)
- [CLI Guide](../docs/cli.md)
- [Node Integration Guide](../docs/integration-node.md)
- [Webhook Guide](../docs/webhooks.md)
- [AI Deploy Demo](../docs/demo-ai-deploy.md)
- [API Quickstart](../docs/api-quickstart.md)
