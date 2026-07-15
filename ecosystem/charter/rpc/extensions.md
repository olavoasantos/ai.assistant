# RPC Extensions and Ecosystem Integration

This document is part of the normative [RPC charter](./README.md).

## Plugin Execution

- RPC uses the ecosystem plugin engine as its only generic plugin orchestration mechanism.
- Value matching, serialization, hydration, middleware, lifecycle, and observation execute through RPC-specific plugin hooks.
- Hook ordering, contexts, short-circuiting, error policy, freezing, forking, and disposal follow the plugin charter.
- Incoming middleware cannot dispatch one accepted request more than once.
- Outgoing middleware that retries creates a new attempt and does not change the at-most-once guarantee of an individual request.
- Direct value-hook execution is part of RPC’s performance budget. If generic hook overhead is unacceptable, the ecosystem plugin engine itself is improved rather than bypassed with a hidden RPC plugin path.
- Required core behavior may use mandatory hooks that cannot be removed from an active session.

## Observation and Telemetry

- Public lifecycle and diagnostic events use the ecosystem event model.
- Event and observer payloads exclude credentials and application values by default.
- Listener, inspector, and telemetry failures cannot change protocol progress, operation settlement, authority, resource release, or cleanup unless installed as explicit middleware.
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

RPC-specific hooks extend the ecosystem plugin contracts. RPC does not maintain a second plugin runner, ordering model, middleware engine, context system, or plugin error policy.

## Events

Transports, sessions, nodes, servers, and clients expose typed lifecycle and diagnostic events through the ecosystem event model. RPC event names use the `rpc:{dot.notation.pastTenseVerb}` pattern and describe the subject occurrence rather than the observing facade. Transport events bubble through their session, node, and conventional endpoint ownership chain; session events bubble through their node and endpoint. Event bubbling is local observation and never becomes network protocol traffic.

Current status and one-shot closure promises remain authoritative because event observation can race. Complete inbound frames use the transport subscription data plane rather than high-volume lifecycle events. Calls, references, promises, streams, plugins, and budgets may add typed events when their contracts define stable observation semantics.

## Telemetry

RPC records connection, compatibility, call, callback, promise, stream, validation, plugin, reference, watch, budget, malformed-frame, transport, and cleanup metrics through the ecosystem telemetry contract. Telemetry is operational observation, not protocol authority.

## Signals

The dedicated Preact Signals plugin is an explicit exception to the ordinary foundation rule against exposing and observing raw signals. The exception is narrow: remote subscribability is the feature, consumers receive read-only signal types, and the plugin owns observation and cleanup.

## Executable

RPC servers, clients, nodes, and sessions do not inherit from Executable. Applications and Executables may own RPC endpoints through ordinary lifecycle integration without importing rendering, kernel, service-container, or application policy into RPC.
