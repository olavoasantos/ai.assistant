# Charter — @ai.assistant/validation implementation

## Purpose

Provide the default environment-agnostic implementation of the validation contract described by `ecosystem/charter/validation/README.md` and `@ai.assistant/contracts/validation`.

## What It Is

- The concrete implementation of the callable `Rule` contract.
- The runtime home for built-in validator factories, built-in rule factories, and validation helper utilities.
- The source package that platform, domain, and client code consume when they need runtime validation.
- The bridge from validation failures to structured `ApplicationError` instances for throwing APIs.

## What It Is Not

- Not a second contract. Consumer-facing shape lives in `@ai.assistant/contracts/validation`.
- Not a domain extension point. Domain-specific validation metadata is added through contract declaration merging.
- Not a presentation, translation, or form adapter.

## Invariants

### Contract Alignment

- `createRule` returns objects satisfying `Contract.Rule`.
- `Ok` and `Err` return the result shapes declared by the contract.
- Built-in validators and rules expose contract-compatible `Rule` values.
- Shared compliance tests from `@ai.assistant/tests/validation` run as integration tests for this source package.

### Implementation Shape

- `createRule` is the only primitive used to construct built-in validators, built-in rules, optional variants, and custom rules.
- Built-in validators and rules are standalone named exports so consumers can import only the pieces they use.
- Container traversal is separated from validator factories so object and array logic stays testable in isolation.
- Internal traversal context is threaded through validation options internally and is not part of the public contract surface.

### Error Integration

- Throwing APIs create `ApplicationError` instances from `@ai.assistant/error`.
- Thrown validation errors use message `Validation failed`, code `400`, and severity `'recoverable'`.
- Validation issues are converted into `ErrorIssue` instances and retain message and path information.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- No asynchronous validation behavior.
- No domain vocabulary or product-specific assumptions.
- The contract lives in `@ai.assistant/contracts/validation`; this module implements it and the TypeScript compiler enforces alignment.
