/**
 * Validation domain types.
 *
 * Defines the runtime validation system used throughout the platform.
 * Validators are composable functions that check data structures and
 * value constraints independently.
 */
import type {StandardSchemaV1} from '@standard-schema/spec';
import type {ValidationMetadata} from '..';

export type {ValidationMetadata} from '..';

/**
 * Partial success result returned by a rule's `validate` function.
 *
 * - `Ok()` — pass, keep the current value as-is.
 * - `Ok(newValue)` — pass and transform: the engine replaces the current
 *   value with `newValue`.
 *
 * @template Output - The type of the transformed output value, if any.
 */
export interface OkResult<Output = unknown> {
  /** Discriminant indicating success. Always `true`. */
  readonly ok: true;
  /**
   * The transformed output value. When omitted the engine keeps the input
   * as-is. When provided the engine replaces the current value with it.
   */
  readonly value?: Output;
}

/**
 * Partial failure result returned by a rule's `validate` function.
 *
 * - `Err()` — fail with a single default issue generated from the rule's
 *   name and parent context.
 * - `Err(issue1, issue2, ...)` — fail with explicit issue descriptors.
 */
export interface ErrResult {
  /** Discriminant indicating failure. Always `false`. */
  readonly ok: false;
  /**
   * Explicit issue descriptors. When omitted the engine generates a single
   * default issue using the rule's name and parent context.
   */
  readonly issues?: readonly IssueDescriptor[];
}

/**
 * Union of {@link OkResult} and {@link ErrResult}. Return type of a rule's
 * `validate` function — either a pass (with optional transform) or a fail
 * (with optional explicit issues).
 *
 * @template Output - The type of the transformed output value on success.
 */
export type RuleResult<Output = unknown> = OkResult<Output> | ErrResult;

/**
 * Complete success result produced by the validation engine.
 *
 * Discriminated on `ok: true`. The `value` field always contains the
 * validated (and potentially transformed) output. `issues` is always
 * `undefined`.
 *
 * @template Output - The validated output type.
 */
export interface SuccessResult<Output = unknown> {
  /** Discriminant indicating success. Always `true`. */
  readonly ok: true;
  /** The validated (and potentially transformed) output value. */
  readonly value: Output;
  /**
   * Always `undefined` on success.
   */
  readonly issues: undefined;
}

/**
 * Complete failure result produced by the validation engine.
 *
 * Discriminated on `ok: false`. Contains at least one error-severity
 * {@link Issue}.
 */
export interface FailureResult {
  /** Discriminant indicating failure. Always `false`. */
  readonly ok: false;
  /** Always `undefined` on failure. */
  readonly value: undefined;
  /** One or more error-severity validation issues. */
  readonly issues: readonly Issue[];
}

/**
 * Discriminated union of {@link SuccessResult} and {@link FailureResult}.
 *
 * The primary return type of `.validate()`. Discriminate on the `ok` field
 * to narrow to success or failure:
 *
 * ```ts
 * const result = schema.validate(data);
 * if (result.ok) {
 *   result.value; // Output
 * } else {
 *   result.issues; // Issue[]
 * }
 * ```
 *
 * @template Output - The validated output type on success.
 */
export type Result<Output = unknown> = SuccessResult<Output> | FailureResult;

/**
 * Key-value bag of interpolation data attached to issues.
 *
 * Extras carry rule configuration parameters (e.g. `{ min: 3 }` for a
 * `minLength` rule) so that message resolvers can produce human-readable
 * strings like `"Must be at least 3 characters"`.
 */
export interface RuleExtras extends Record<string, unknown> {}

/**
 * An error-severity validation issue produced by the engine.
 *
 * Issues are the enriched form of {@link IssueDescriptor} — after
 * structured message keys, rule name, path, and merged extras have
 * been applied.
 */
export interface Issue {
  /**
   * Structured message key (e.g. `'validation.string.minLength'`) or a
   * custom message override set via {@link ValidationOptions.message}.
   */
  readonly message: string;
  /** Location within a nested structure. */
  readonly path?: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment>;
  /** Name of the rule that produced this issue. */
  readonly rule: string;
  /** Interpolation data for message template resolution. */
  readonly extras?: RuleExtras;
}

/**
 * Partial issue descriptor returned by rule authors via `Err()`.
 *
 * Rule authors provide a `message` and optional `extras`. The engine
 * enriches this into a full {@link Issue}, filling in defaults for any
 * omitted fields.
 */
export interface IssueDescriptor {
  /** Custom message key or text. When omitted the engine generates a structured key. */
  readonly message: string;
  /** Additional interpolation data to merge with the rule's own extras. */
  readonly extras?: RuleExtras;
}

/**
 * Context object passed to rule `validate` functions as the second argument.
 *
 * Provides cross-field context for conditional and dependent validation.
 */
export interface ValidationContext {
  /** Merged validation options for the current pass. */
  readonly options: ValidationOptions;
  /** The top-level value being validated. Set to the input value at the root. */
  readonly root: unknown;
  /** The immediate containing object or array. `undefined` at the root level. */
  readonly parent: unknown;
  /** Current position within a nested structure as an array of property keys. Empty at the root. */
  readonly path: ReadonlyArray<PropertyKey>;
  /** The current property key within the parent. `undefined` at the root level. */
  readonly key: PropertyKey | undefined;
}

/**
 * Options that control validation behavior. Can be set at two levels:
 *
 * - **Schema-level** — passed to a validator factory as defaults.
 * - **Call-site** — passed to `.validate()`, `.ensureValid()`, `.parse()`, or `.ensureParse()` to override.
 *
 * Call-site options are shallow-merged over schema-level options.
 */
export interface ValidationOptions {
  /**
   * When `true`, stop at the first failure instead of collecting all issues.
   */
  readonly bail?: boolean;
  /**
   * Custom error message override. When set, replaces the structured message
   * key on all issues produced by this validator.
   */
  readonly message?: string;
}

/**
 * Options for the `object` validator, extending {@link ValidationOptions} with
 * control over how properties not declared in the shape are handled.
 */
export interface ObjectValidationOptions extends ValidationOptions {
  /**
   * How to handle input properties that are not declared in the shape:
   *
   * - `'strip'` (default) — unknown keys are silently removed from the output.
   * - `'reject'` — unknown keys cause validation failure, with issues
   *   identifying the offending keys.
   * - `'passthrough'` — unknown keys are preserved in the output; the output
   *   type lifts to include `Record<string, unknown>`.
   */
  readonly extraProperties?: 'strip' | 'reject' | 'passthrough';
  /** Rules that apply to the object container itself (e.g. size constraints). */
  readonly rules?: readonly Rule<any>[];
}

/**
 * Options for composite validators (arrays, records, etc.) that need
 * container-level rules in addition to content schemas.
 */
export interface CompositeValidationOptions extends ValidationOptions {
  /** Rules that apply to the container itself (e.g. size constraints). */
  readonly rules?: readonly Rule<any>[];
}

/**
 * Structural metadata attached to every validator via the `.meta` property.
 *
 * Always contains the rule `name`. May contain a `description` and any
 * additional developer-supplied key-value pairs set via `.set()` or
 * `.setMany()`. The `name` field is immutable after construction.
 */
export interface Meta extends ValidationMetadata {
  /** The rule name (e.g. `'string'`, `'minLength'`). */
  readonly name: string;
  /** Human-readable description. */
  readonly description?: string;
}

/**
 * Fields of a {@link Meta} that can be mutated after construction
 * via the `set()` and `setMany()` methods on a {@link Rule}.
 */
export interface UpdatableMetaOptions extends ValidationMetadata {
  /** Human-readable description. */
  readonly description: string;
}

/** Execution phase for rule ordering: transforms, checks, then cross-field rules. */
export type RuleOrder = 'pre' | 'default' | 'post';

/**
 * The `validate` function signature for a rule descriptor.
 *
 * Receives the input value and a {@link ValidationContext}, and returns
 * a {@link RuleResult} — either `Ok()` / `Ok(newValue)` for success or
 * `Err()` / `Err(...issues)` for failure.
 *
 * @template Input - The expected input type.
 * @template Output - The output type (may differ from Input for transforms).
 */
export type Validator<Input = unknown, Output = Input> = (
  value: Input,
  context: ValidationContext,
) => RuleResult<Output>;

/**
 * A traversal function for composite validators (objects, arrays, etc.).
 *
 * Receives the already-validated parent value and a validation context,
 * then descends into children, validating each against its respective
 * schema. Returns a complete {@link Result} reflecting the aggregate
 * outcome.
 *
 * @template Input - The composite value type to traverse.
 * @template Output - The output type after child validation.
 */
export type Traverser<Input = unknown, Output = Input> = (
  value: Input,
  context: ValidationContext,
) => Result<Output>;

/**
 * Configuration object passed to `createRule` to define a rule's
 * behavior, identity, and composition.
 *
 * The descriptor determines what kind of rule is created:
 * - **Leaf rule** — only `name` and `validate`. For validation checks and transforms.
 * - **Type guard** — adds `rules` for sub-rule composition.
 * - **Composite** — adds `traverse` for descending into children.
 *
 * @template Input - The expected input type.
 * @template Output - The output type after validation/transformation.
 */
export interface RuleDescriptor<Input = unknown, Output = Input> {
  /** Identifier used for structured message keys (e.g. `'minLength'` produces `validation.string.minLength`). */
  readonly name: string;
  /** The validation/transformation function. */
  readonly validate: Validator<Input, Output>;
  /**
   * Execution phase: `'pre'` for transforms, `'default'` for most checks,
   * `'post'` for cross-field/context-dependent rules. Defaults to `'default'`.
   */
  readonly order?: RuleOrder;
  /**
   * Interpolation data for message templates. Can be a static object or a
   * factory function that produces one. Merged into every issue's `extras`.
   */
  readonly extras?: RuleExtras | (() => RuleExtras);
  /** Traversal function for composite types. Called after sub-rules pass. */
  readonly traverse?: Traverser<Output>;
  /** Sub-rules to execute after the main `validate` passes. Sorted by `order`. */
  readonly rules?: readonly Rule<Output>[];
  /** Initial metadata entries merged into the rule's `.meta` property. */
  readonly meta?: Record<string, unknown>;
  /** Schema-level default options. Overridden by call-site options. */
  readonly options?: ValidationOptions;
}

/**
 * A callable validator produced by `createRule`.
 *
 * The rule is a callable object — invoking it directly aliases `.validate()`.
 * It exposes multiple validation modes and metadata.
 *
 * @template Input - The expected input type.
 * @template Output - The validated output type.
 */
export interface Rule<Input = unknown, Output = Input> extends StandardSchemaV1<Input, Output> {
  /**
   * Validate a value and return a full {@link Result}.
   * Direct invocation — equivalent to calling `.validate()`.
   *
   * @param value - The value to validate.
   * @param options - Call-site options that override schema-level defaults.
   */
  (value: unknown, options?: ValidationOptions): Result<Output>;
  /**
   * Validate a value and return a full {@link Result}.
   *
   * @param value - The value to validate.
   * @param options - Call-site options that override schema-level defaults.
   */
  validate(value: unknown, options?: ValidationOptions): Result<Output>;
  /**
   * Validate a value and return a {@link SuccessResult}. Throws
   * `ApplicationError` if validation fails.
   *
   * @param value - The value to validate.
   * @param options - Call-site options that override schema-level defaults.
   * @throws ApplicationError when validation fails.
   */
  ensureValid(value: unknown, options?: ValidationOptions): SuccessResult<Output>;
  /**
   * Parse a value and return the output or `undefined`.
   *
   * @param value - The value to parse.
   * @param options - Call-site options that override schema-level defaults.
   */
  parse(value: unknown, options?: ValidationOptions): Output | undefined;
  /**
   * Parse a value and return the output directly. Throws
   * `ApplicationError` if validation fails.
   *
   * @param value - The value to parse.
   * @param options - Call-site options that override schema-level defaults.
   * @throws ApplicationError when validation fails.
   */
  ensureParse(value: unknown, options?: ValidationOptions): Output;
  /**
   * Updates a single metadata field after construction.
   *
   * @template Key - The field to update.
   * @param key - The field name.
   * @param value - The new value.
   * @returns This rule, for chaining.
   */
  set<Key extends keyof UpdatableMetaOptions>(
    key: Key,
    value: UpdatableMetaOptions[Key],
  ): Rule<Input, Output>;
  /**
   * Updates multiple metadata fields after construction.
   *
   * Shallow-merges the provided fields into `.meta`. Multiple calls
   * accumulate metadata — later calls overwrite same-keyed properties
   * but do not remove existing ones.
   *
   * @param options - Partial set of metadata fields to merge.
   * @returns This rule, for chaining.
   */
  setMany(options: Partial<UpdatableMetaOptions>): Rule<Input, Output>;
  /**
   * Create a variant of this rule that also accepts `undefined`.
   *
   * When the input is `undefined` (and no default is provided), validation
   * is skipped and the result succeeds with `undefined`.
   */
  optional(): Rule<Input | undefined, Output | undefined>;
  /**
   * Create a variant of this rule that accepts `undefined` with a default.
   *
   * When the input is `undefined`, the `defaultValue` is validated through
   * the original rule instead.
   *
   * @param defaultValue - Value to substitute when the input is `undefined`.
   */
  optional(defaultValue: Input): Rule<Input | undefined, Output>;
  /**
   * Type predicate that returns `true` when the value passes validation.
   *
   * Narrows the input to `Input & Output` in TypeScript control flow.
   * Returns `true` when the full validation pipeline succeeds (validate
   * → sub-rules → traverse).
   *
   * The parameter type is constrained to `Input`, ensuring callers provide
   * a value the rule can actually validate. For identity rules where
   * `Input` is `unknown`, any value is accepted. For constrained rules
   * (e.g. `Rule<string, string>`), only matching input types are accepted.
   *
   * For transform rules where `Output` differs from `Input`, the narrowed
   * type becomes `Input & Output` (typically `never`), making the result
   * unusable — which correctly prevents misuse since the original value
   * has not been transformed.
   *
   * @param maybe - The value to check.
   * @returns `true` if the value passes all validation steps.
   */
  is(maybe: Input): maybe is Input & Output;
  /**
   * Execution phase of this rule: `'pre'`, `'default'`, or `'post'`.
   */
  readonly order: RuleOrder;
  /**
   * Structural metadata for this rule. Contains the rule name, optional
   * description, and any developer-supplied metadata set via `.set()`
   * or `.setMany()`.
   */
  meta: Meta;
}
