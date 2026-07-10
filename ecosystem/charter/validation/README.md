# Charter — validation

## Purpose

A composable runtime validation foundation for the platform. Validation checks runtime values at system boundaries and returns structured, inspectable results without coupling consumers to a specific implementation strategy.

## What It Is

- A set of validator factories (`string()`, `number()`, `boolean()`, `object()`, `array()`) that check data structure.
- A set of rule factories (`email()`, `minLength()`, `maxLength()`, `min()`, `max()`, `trim()`) that check or transform values.
- A single rule descriptor contract from which validators, rules, and combinators are built.
- A structured issue producer for invalid values, including message keys, rule names, paths, and interpolation extras.
- An `ApplicationError` producer for callers that choose throwing APIs.

## What It Is Not

- Not a schema definition language. It validates runtime values; it does not generate database schemas, API descriptions, or TypeScript declarations.
- Not a form library. It produces structured results; presentation and message rendering happen elsewhere.
- Not an i18n system. Issues carry message keys and extras; translation is a separate concern.
- Not a replacement for TypeScript. Types are written explicitly and validators enforce compatible runtime values.
- Not domain-aware. It knows nothing about products, users, agents, or client features.

## Invariants

### Rule Model

- Every validator, rule, and combinator is represented as a callable `Rule`.
- Direct invocation aliases `.validate(value, options?)`.
- A rule descriptor has a stable `name`, a `validate(value, context)` function, optional sub-rules, optional traversal, optional extras, and optional default options.
- `Ok()` means pass while keeping the current value. `Ok(newValue)` means pass and replace the current value with the returned value.
- `Err()` means fail with a default issue. `Err(...issues)` means fail with explicit issue descriptors.

### Execution Pipeline

- Each validation call runs the descriptor validation first, then sub-rules, then traversal.
- Sub-rules are sorted by phase: `pre`, then `default`, then `post`.
- Sub-rules in the same phase keep their declared relative order.
- A failure skips subsequent pipeline stages for that value.
- `bail: true` stops at the first failure within an accumulation scope.
- Transform rules use `pre` order when downstream rules must see transformed values.

### Results and Errors

- Validation results are discriminated by `ok: true | false`.
- Success is `{ ok: true, value, issues: undefined }`.
- Failure is `{ ok: false, value: undefined, issues }` with at least one issue.
- `.parse()` returns the validated value or `undefined`.
- `.ensureValid()` returns the success result or throws an `ApplicationError`.
- `.ensureParse()` returns the validated value or throws an `ApplicationError`.
- Throwing APIs attach validation issues as structured error issues.

### Issues

- Default issue messages use `validation.{rule}` for top-level failures.
- Sub-rule issue messages use `validation.{parent}.{rule}`.
- Issues carry the producing `rule` name.
- Issues may carry `extras` for message interpolation.
- Nested object and array failures prepend path segments for the failing property or index.
- Call-site `message` options override produced issue messages for that validator.

### Composition

- Primitive validators accept value rules as optional sub-rules.
- Composite validators validate their container before traversing child schemas.
- Array validators apply one child schema to each element.
- Object validators apply one child schema per declared property.
- Object extra properties are stripped by default, rejected when `extraProperties` is `'reject'`, and retained when it is `'passthrough'`.
- Optional rules accept `undefined`; optional rules with defaults validate the default through the original rule.

### Metadata and Extensibility

- Every rule exposes metadata with immutable `name` and optional mutable description and extension fields.
- `.set(key, value)` replaces a single mutable metadata field and returns the rule.
- `.setMany(options)` shallow-merges mutable metadata fields and returns the rule.
- The `ValidationMetadata` contract interface is open for declaration merging by domain packages.
- Custom validators and rules are built by providing a rule descriptor; no separate plugin system is required.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- Synchronous only. Async validation is outside the current foundation.
- Runtime dependencies are limited to other foundations and type-level interoperability packages.
- The contract lives in `@ai.assistant/contracts/validation`; source implementations must satisfy it and run shared compliance tests from `@ai.assistant/tests/validation`.
