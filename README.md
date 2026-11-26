# Requirements Engineering Application

**ReadBuddy** — a web application that helps children with reading difficulties practise reading, with teacher class management and progress tracking.

This repository compares two requirement styles for the same product idea:

| Version | Spec style | Documents |
|---------|------------|-----------|
| **A** | Structured SRS (ISO/IEC/IEEE 29148-inspired) | [specification_A.md](document/application_doc/specification/specification_A.md), [architect_A.md](document/application_doc/architect/architect_A.md) |
| **B** | Informal / weak requirements | [specification_B.md](document/application_doc/specification/specification_B.md), [architect_B.md](document/application_doc/architect/architect_B.md) |

The version A implementation lives in [`app/`](app/) — see [`app/README.md`](app/README.md) for setup and requirement coverage.

## Branches

| Branch | Version | Description |
|--------|---------|-------------|
| `A` | Version A | Application guided by the **structured** specification |
| `B` | Version B | Application guided by the **informal** specification |

## Document folder

| Path | Purpose |
|------|---------|
| [`document/application_doc/`](document/application_doc/) | Specs, architectures, notes — see [Note.md](document/application_doc/Note.md) |

Literature review materials are **not** stored in this repository.

## Contributing

Commit messages follow [CONTRIBUTING.md](CONTRIBUTING.md) (Conventional Commits).
