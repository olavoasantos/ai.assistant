# Charter

This charter describes the TypeScript framework that ai.assistant's application layer is built on. It covers the shared infrastructure — not the ai domain, not the product features, not the data platform.

## Purpose

Provide a minimal, contract-driven foundation that application code consumes without coupling to implementation details. Every subsystem (errors, containers, services, data sources) follows the same structural discipline: a contract defines what consumers depend on; one or more sources implement it.

## Layer Model

```
ecosystem/contracts        → consumed surfaces (interfaces, types)
ecosystem/tests            → tests ensuring behavioural compliance of ecosystem implementation.
ecosystem/sources/*/*      → implementations of contracts (zero domain knowledge)
domains/*                  → business logic built on foundations (ai-aware)
clients/*                  → user-facing applications built on domains
```

Each layer depends only on layers above it. No layer reaches down.

### Contracts

Pure TypeScript types and interfaces. No runtime code. Defines what consumers are allowed to depend on — method signatures, data shapes, behavioural promises expressed as types. Extended via declaration merging for domain-specific needs.

The compiler is the automatic check binding contracts to implementations.

### Sources

Environment-agnostic implementations of contracts. Each source module:

- Implements one or more contracts via `implements`
- Has zero domain knowledge (knows nothing about ai, users, or product)
- Has zero external runtime dependencies (other foundations are acceptable)
- Is identified by symbol branding for cross-boundary type narrowing

### Domains

Business logic that composes foundations to solve domain problems. AI-aware. Product-aware. May depend on foundations and contracts, never on apps.

### Clients

Entry points that wire domains to infrastructure (HTTP, databases, UI frameworks, schedulers). Never contain business logic directly.

## Cross-Cutting Invariants

- **Errors are structured.** Every thrown error in the system is (or normalizes to) an `ApplicationError`. No string throws, no unstructured rejects.
- **Contracts are the truth.** If a consumer needs to know what a thing does, the contract is the answer. Implementation details are private.
- **Symbol branding for identity.** Cross-boundary type checks use `Symbol.for()` brands, never `instanceof`. This survives multiple package versions, bundler deduplication failures, and realm crossings.
- **Types are written, not inferred from runtime.** Runtime guards validate; TypeScript types declare. They don't derive from each other.
- **Declaration merging for extensibility.** When a foundation defines an extensible surface (e.g., error metadata), domains extend it via `register.d.ts` — not by modifying the foundation.
- **Contract docblocks describe behavior, not mechanism.** Docblocks in `contracts/` describe what consumers can depend on — semantics, shapes, guarantees. They never reference implementation libraries, external specification names, internal package paths, or runtime mechanisms. Those details belong in charters and implementation docblocks.

## Strand Configuration

This repository uses the **helix discipline** with module-specific strand counts:

- **Ecosystem** (e.g., `ecosystem/*`): four strands — charter, contract (`@ai.assistant/contracts`), tests, implementation.
- **Domains**: three strands — charter, tests, implementation. Contracts are consumed, not produced.
- **Clients**: three strands — charter, tests, implementation.

The `contracts` package itself does not carry a charter. It IS the contract strand for every module that implements it. Its types are self-specifying.

## Related Charters

- [API Conventions](./api-conventions.md) — proven patterns for public API shape across the platform.

## Out of Scope

This charter does not govern:

- The PostgreSQL schema or ingestion infrastructure
- Product decisions (features, UX, priorities)
- Deployment, CI/CD, or operational concerns
- The ai domain model (that's `domains/` territory once it exists)
