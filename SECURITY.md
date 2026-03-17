# Security Policy

## Reporting A Vulnerability

Please report sensitive security issues privately to [founders@approva.xyz](mailto:founders@approva.xyz).

Include as much detail as you can:

- affected version, tag, or commit SHA
- deployment mode and environment details
- reproduction steps or proof of concept
- impact assessment
- any suggested mitigation

Do not open a public GitHub issue for a suspected vulnerability, credential leak, auth bypass, or other sensitive security report.

## What To Expect

- We will acknowledge receipt as quickly as we can.
- We may ask follow-up questions or request a private reproduction.
- We will validate the issue, assess impact, and work on a fix or mitigation.
- When appropriate, we will coordinate disclosure timing with the reporter.

## Supported Open-Core Releases

Approva Open Core is currently supported on a rolling basis.

- `main`: supported
- most recent tagged public open-core release: intended to receive security fixes when practical
- older tags, forks, and untagged historical snapshots: not guaranteed to receive fixes

If no public release has been tagged yet, assume only the current `main` branch is supported for security updates.

## Scope

This repository is the public self-hostable open-core codebase.

- hosted Approva Cloud features and operations are managed separately
- security reports for this repository should focus on the code and docs published here
- if you are unsure whether an issue belongs here, email us privately first
