# Runtime Modes

Approva Open Core defaults to:

```bash
AUTHON_RUNTIME_MODE=open-core
```

## Open-Core Mode

Open-core mode is the supported public-repo runtime.

- creates or resolves the default organization automatically
- allows direct console access without dashboard sign-in
- keeps approval auth separate from any optional dashboard auth
- enables policies, integrations, service accounts, organization API keys, audit, immutable log, and ledger verification

## Cloud Compatibility Flag

The shared config package still recognizes:

```bash
AUTHON_RUNTIME_MODE=cloud
```

That flag remains for codebase compatibility, but this public repository is documented and
supported around `AUTHON_RUNTIME_MODE=open-core`.

## Backward-Compatible Fallback

`AUTHON_SELF_HOST_MODE=true` still resolves to open-core mode when `AUTHON_RUNTIME_MODE` is not
set, but `AUTHON_RUNTIME_MODE=open-core` is the preferred setting.
