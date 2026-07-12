# Charter — Intents

## Purpose

Provide definition, resolution, and invocation for scoped executable work. Intents describe work; activities execute it inside lifecycle-controlled scopes; the registry binds definitions to declared scope and kernel templates.

## What It Is

- A registry of immutable intent identities with mutable execution details.
- Synchronous lookup and asynchronous lazy resolution.
- Matching, priority ordering, provider-assisted disambiguation, and invocation.
- Activity execution with awaitable, streaming, and detached response modes.
- Nested executable scopes that inherit application infrastructure while selecting activity-specific provider hooks.

## What It Is Not

- Not an HTTP router, URL model, scheduler, job queue, retry system, or persistence layer.
- Not domain-aware.
- Not a replacement for Application or Executable lifecycle ownership.
- Not permission for activities to replay ordinary Application provider hooks.

## Invariants

### Intent identity and mutation

- Intent identity is `action + mimeType + scope + kernel + vendor` and never changes after registration.
- Registering the same identity updates mutable fields on the existing Intent.
- Mutable fields include name, description, handler, validation rules, metadata, mode, and priority.
- Intent identity uses `Symbol.for('ai.assistant:Intent')`.

### Scope templates

- Application construction supplies static scope definitions.
- Each scope and kernel pair expands to one execution template with optional activity-specific providers.
- Registration rejects definitions whose scope and kernel have no template.
- Templates do not change after registry construction.

### Resolution and matching

- `get`, `getAll`, `ensure`, and `ensureAll` inspect registered definitions synchronously and never perform lazy resolution.
- Synchronous provider `match` hooks may veto immutable-field matches but cannot expand them.
- `resolve`, `resolveAll`, `require`, and `requireAll` first collect definitions from provider `resolve` hooks, register them, and then perform matching.
- URI and object queries have equivalent semantics. Explicit invocation options override URI-derived input.
- `ensure` and `require` variants throw when no match exists.

### Disambiguation and invocation

- One match is invoked directly.
- A unique highest priority wins among multiple matches.
- Equal-priority ambiguity is offered to provider `disambiguate` hooks in order.
- Remaining ambiguity throws instead of selecting unpredictably.
- `invokeAll` launches every match without disambiguation.
- Direct `intent.invoke()` bypasses resolution because the target is already known.

### Activities

- Activity identity uses `Symbol.for('ai.assistant:Activity')`.
- An Activity is an Executable specialized with the complete service-provider hook map.
- The Activity specialization invokes `createActivity`, `uiActivity`, `initializeActivity`, `activateActivity`, `deactivateActivity`, `disposeActivity`, and `errorActivity`.
- Ordinary provider lifecycle hooks never run for an Activity unless a provider separately implements the corresponding activity hook.
- The Activity kernel always receives ordinary executable kernel hooks.
- Input validation completes before the handler runs.
- Handler context exposes the Activity, scoped services, telemetry, validated input, and rendering callback.
- Rendering updates immediately recompose provider and kernel wrappers.

### Responses

- Awaitable activities expose one response promise and reject duplicate responses.
- Streaming activities expose an ordered async iterable terminated by `complete` or disposal.
- Detached activities expose no response channel and reject response attempts.
- Success payloads pass output validation before delivery.
- Application-level handler failures become error responses where a response channel exists.

### Ownership and cleanup

- Application owns the root registry and root activity tracking.
- Activity registry views share definitions and templates while associating invocation with the current Activity.
- Nested invocation creates parent-child Activity relationships.
- Disposal recursively disposes children, detaches the Activity from parent and Intent tracking, removes root tracking, and closes its response controller.
- Runtime ancestry checks use symbol branding rather than `instanceof`.

## Constraints

- Environment-agnostic across browsers, servers, workers, and edge runtimes.
- Runtime dependencies are limited to ecosystem foundations and signals.
- The consumed surface lives at `@ai.assistant/contracts/intents`.
- Every implementation runs `@ai.assistant/tests/intents`.
