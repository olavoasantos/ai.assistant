# RPC Extensions and Ecosystem Integration

This document is part of the normative [RPC charter](./README.md).

## Plugin Execution

- RPC uses the ecosystem plugin engine as its only generic plugin orchestration mechanism.
- Value serialization, hydration, value control, incoming/outgoing middleware, endpoint/session setup, observation, and endpoint/session disposal execute through RPC-specific plugin hooks.
- Hook ordering, contexts, short-circuiting, error policy, protection, freezing, forking, and disposal follow the plugin charter.
- Hooks receive explicit least-capability inputs. The generic plugin `this` context never exposes the mutable RPC endpoint, session, authority tables, correlation registries, or canonical frames.
- Incoming and outgoing middleware form separate onion chains over one discriminated semantic-operation model. Operation identity, kind, target category, and cancellation are immutable; middleware may replace the operation-specific semantic payload through explicit capabilities.
- Incoming middleware cannot dispatch one accepted request more than once. PluginEngine permits each `next()` continuation to be called at most once.
- Outgoing middleware that retries uses an explicit attempt capability to create a new attempt; it does not call the same middleware continuation twice or change the at-most-once guarantee of an individual request.
- Value traversal uses a bounded synchronous PluginEngine direct scope. Ordering and contexts are prepared once per graph, configured caching and runner error policy remain active, and measurement is aggregated around the graph rather than emitted for every visited node.
- Core remote-value behavior is installed as ordinary mandatory plugins. Active core and negotiated wire plugin objects are protected from removal for the session while descriptor-free local plugins remain mutable.
- Endpoint setup runs once before a plugin participates in endpoint work. Negotiated session setup completes before root delivery; setup failure of an active required plugin rejects establishment.
- A descriptor-free plugin added to an active session completes session setup before becoming eligible for execution. Removing it invokes session cleanup before PluginEngine membership removal.
- Session setup gives each plugin a scoped budget capability for only its declared, finite, plugin-qualified capacity categories. Plugins reserve atomically through that capability and cannot mutate the core ledger or another plugin's allocation. Per-frame and per-graph plugin maxima remain enforced through core frame, payload, and decode categories.
- Each successful plugin-state lease declares a positive aggregate entry count. RPC charges that count to core plugin-state capacity atomically with every named plugin sub-budget; declaring more categories cannot create unbounded aggregate capacity. Plugin control traffic is charged automatically to core plugin-message capacity.
- Invalid local reservation requests, including undeclared or duplicate categories and invalid amounts, fail without mutating usage. Capacity exhaustion either rejects the operation without mutation or reports that RPC has already begun host-owned session teardown.
- Session cleanup and endpoint cleanup are distinct hooks with distinct least-capability contexts. Cleanup is attempted for every initialized plugin even when another plugin's cleanup fails, and core teardown reclaims host-tracked plugin reservations independently.
- In-process plugins are trusted code for private CPU, memory, timers, and references that they allocate outside host capabilities. Supporting hostile plugin code requires runtime isolation and does not weaken accounting for host-mediated frames, values, messages, or state.

## Observation and Telemetry

- Public lifecycle and diagnostic events use the ecosystem event model.
- Event and observer payloads exclude credentials, application arguments, results, stream items, reactive values, and raw frames by default. They may include opaque local correlation, kinds, counts, sizes, durations, outcome classifications, and normalized errors.
- RPC observation hooks use PluginEngine's contained observation strategy. A fatal observer failure may stop remaining observers and produce diagnostics, but cannot change protocol progress, operation settlement, authority, resource release, or cleanup.
- Resource observations identify core or plugin ownership, stable category, unit, accounting mode, current use, and effective limit without exposing reservation or release authority.
- Plugins that need to inspect or affect application values must install explicit middleware and thereby participate in operation outcomes.
- High-volume frame, item, and update observations are aggregated or opt-in.
- RPC endpoints accept optional telemetry and create a correctly scoped default when none is supplied.
- RPC disposes owned default telemetry. Injected telemetry remains caller-owned.
- Timers and measurements complete exactly once across success, failure, cancellation, rejection, disconnect, and disposal.

## Errors

All local and remote failures normalize to `ApplicationError`. RPC does not define a competing error hierarchy or severity vocabulary.

Remote serialization preserves contractually defined error fields, issues, and bounded causes. Stack traces, credentials, payload values, and sensitive causes are excluded by default. Received errors reconstruct through the canonical error deserialization boundary.

## Validation

Application operation boundaries accept Standard Schema-compatible rules. Validation may apply to arguments, results, callbacks, promise settlements, and stream items and may transform successful values.

Invalid input never reaches application handlers. Invalid output never reaches a consumer as successful data. Protocol-frame validation is separate from application schema validation and always occurs first.

## Plugins

RPC-specific hooks extend the ecosystem plugin contracts. Wire value plugins also declare how their owner-side value types project into consumer types so nested plugin values remain typed without core-contract modification. RPC does not maintain a second plugin runner, ordering model, middleware engine, context system, or plugin error policy.

## Events

Transports, sessions, nodes, servers, and clients expose typed lifecycle and diagnostic events through the ecosystem event model. RPC event names use the `rpc:{dot.notation.pastTenseVerb}` pattern and describe the subject occurrence rather than the observing facade. Transport events bubble through their session, node, and conventional endpoint ownership chain; session events bubble through their node and endpoint. Event bubbling is local observation and never becomes network protocol traffic.

Current status and one-shot closure promises remain authoritative because event observation can race. Complete inbound frames use the transport subscription data plane rather than high-volume lifecycle events. Calls, references, promises, streams, plugins, and budgets may add typed events when their contracts define stable observation semantics.

## Telemetry

RPC records connection, compatibility, call, callback, promise, stream, validation, plugin, reference, watch, budget, malformed-frame, transport, and cleanup metrics through the ecosystem telemetry contract. Telemetry is operational observation, not protocol authority.

## Signals

The dedicated Preact Signals plugin is an explicit exception to the ordinary foundation rule against exposing and observing raw signals. The exception is narrow: remote subscribability is the feature, consumers receive read-only signal types, and the plugin owns observation and cleanup.

## Executable

RPC servers, clients, nodes, and sessions do not inherit from Executable. Applications and Executables may own RPC endpoints through ordinary lifecycle integration without importing rendering, kernel, service-container, or application policy into RPC.
