import type * as Contract from '@ai.assistant/contracts/error';
import {RecordGuard} from '../guards/RecordGuard';
import {APPLICATION_ERROR_IDENTIFIER} from '../constants';
import {ApplicationErrorGuard} from '../guards/ApplicationErrorGuard';
import {ErrorIssue} from './ErrorIssue';

/**
 * A structured error class used throughout the platform.
 *
 * Extends the native `Error` with additional fields for severity, numeric code,
 * metadata, and issue aggregation. Designed for use across all framework subsystems —
 * lifecycle containers collect errors from providers, the Application aggregates errors
 * from initialization, and errors serialize cleanly for logging and protocol transport.
 *
 * Supports:
 * - **Aggregation** via {@link ApplicationError.add} and {@link ApplicationError.addMany} — collect
 *   child errors from parallel operations as {@link ErrorIssue} instances.
 * - **Post-construction mutation** via {@link ApplicationError.set} and
 *   {@link ApplicationError.setMany} — adjust severity, code, reference, or metadata as errors
 *   bubble through layers.
 * - **Normalization** via the static {@link ApplicationError.from} — convert any thrown value
 *   into a consistent `ApplicationError`. Always creates a new instance.
 * - **Serialization** via {@link ApplicationError.toJSON} — depth-controlled JSON output with
 *   optional stack traces.
 *
 * Uses a Symbol brand for identification, making it reliable across module boundaries,
 * package versions, and realms.
 *
 * @example
 * ```ts
 * // Simple construction
 * throw new ApplicationError('Connection failed');
 *
 * // Rich construction
 * throw new ApplicationError({
 *   message: 'Validation failed',
 *   code: 400,
 *   severity: 'recoverable',
 *   metadata: { fields: ['email', 'name'] },
 * });
 *
 * // Aggregation
 * const error = new ApplicationError('Initialization failed');
 * error.add(providerError1);
 * error.addMany([providerError2, providerError3]);
 *
 * // Normalization
 * const normalized = ApplicationError.from(unknownCaughtValue);
 * ```
 */
export class ApplicationError extends Error implements Contract.ApplicationError {
  /**
   * Normalizes any thrown value into an `ApplicationError`.
   *
   * Always creates a new instance — never returns the input directly,
   * never monkey-patches existing objects.
   *
   * @param value - The value to normalize. Can be anything: `ApplicationError`, `Error`,
   *   string, object with a `message` property, `null`, `undefined`, etc.
   * @returns A new `ApplicationError` instance.
   *
   * @example
   * ```ts
   * try {
   *   await riskyOperation();
   * } catch (error) {
   *   throw ApplicationError.from(error);
   * }
   * ```
   */
  static from(value: unknown): ApplicationError {
    if (ApplicationErrorGuard(value)) {
      const error = new ApplicationError({
        message: value.message,
        code: value.code,
        severity: value.severity,
        reference: value.reference,
        metadata: {...value.metadata},
        cause: value,
      });
      // Issues are shared by reference — safe because ErrorIssue is fully readonly.
      for (const issue of value.issues) {
        error.#issues.push(issue);
      }
      return error;
    }

    if (value instanceof Error) {
      return new ApplicationError({
        message: value.message,
        cause: value,
      });
    }

    if (typeof value === 'string') {
      return new ApplicationError({
        message: value,
        cause: value,
      });
    }

    if (RecordGuard(value) && typeof value.message === 'string') {
      return new ApplicationError({
        message: value.message,
        cause: value,
      });
    }

    return new ApplicationError({
      message: 'An unknown error occurred',
      metadata: {value},
      cause: value,
    });
  }

  /**
   * Numeric error code using HTTP status code values as a widely-known convention.
   * Mutable via {@link ApplicationError.set} or {@link ApplicationError.setMany}.
   */
  code: number;

  /**
   * Severity level controlling how the framework handles this error.
   * Mutable via {@link ApplicationError.set} or {@link ApplicationError.setMany} — hooks can adjust severity as errors bubble.
   */
  severity: Contract.ErrorSeverity;

  /**
   * An optional string reference for traceability.
   * Mutable via {@link ApplicationError.set} or {@link ApplicationError.setMany}.
   */
  reference?: string;

  /**
   * Arbitrary metadata providing additional error context.
   * Mutable via {@link ApplicationError.set} (replaces) or {@link ApplicationError.setMany} (merges).
   */
  metadata: Contract.ErrorMetadata;

  /**
   * ISO 8601 timestamp of when the error was created.
   */
  readonly timestamp: string;

  /** @internal Symbol brand for cross-boundary identification. */
  readonly [APPLICATION_ERROR_IDENTIFIER] = true;

  /** @internal Mutable backing array for issues. */
  #issues: ErrorIssue[] = [];

  /**
   * The aggregated issues collected via {@link ApplicationError.add}.
   * Each issue represents a sub-problem that contributed to this error.
   */

  get issues(): ReadonlyArray<ErrorIssue> {
    return this.#issues;
  }

  /** Whether this error has any aggregated issues. */
  get hasIssues(): boolean {
    return this.#issues.length > 0;
  }

  /**
   * Creates a new `ApplicationError`.
   *
   * @param messageOrOptions - A string message (other fields receive defaults) or a full options object.
   *
   * @example
   * ```ts
   * // From string — defaults for everything else
   * new ApplicationError('Something broke');
   *
   * // From options — full control
   * new ApplicationError({
   *   message: 'Not found',
   *   code: 404,
   *   severity: 'recoverable',
   *   reference: 'user:1234',
   * });
   * ```
   */
  constructor(messageOrOptions: string | Contract.ErrorOptions) {
    const options =
      typeof messageOrOptions === 'string'
        ? ({message: messageOrOptions} as Contract.ErrorOptions)
        : messageOrOptions;

    super(options.message, {cause: options.cause});

    this.code = options.code ?? 500;
    this.severity = options.severity ?? 'recoverable';
    this.reference = options.reference;
    this.metadata = options.metadata ?? {};
    this.timestamp = new Date().toISOString();
  }

  /**
   * Adds a single error as an issue into this error's aggregation.
   *
   * The value is normalized into an {@link ErrorIssue} via {@link ErrorIssue.from}.
   * The original error is preserved as the issue's `cause`.
   *
   * @param issue - The error to aggregate. Accepts `Error`, `ErrorIssue`, or `ApplicationError`.
   * @returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * const error = new ApplicationError('Batch operation failed');
   * error.add(validationError);
   * ```
   */
  add(issue: Error | ErrorIssue | ApplicationError): this {
    this.#issues.push(ErrorIssue.from(issue));
    return this;
  }

  /**
   * Adds multiple errors as issues into this error's aggregation.
   *
   * Each value is normalized into an {@link ErrorIssue} via {@link ErrorIssue.from}.
   * Internally calls {@link ApplicationError.add} for each item.
   *
   * @param issues - The errors to aggregate. Accepts `Error`, `ErrorIssue`, or `ApplicationError`.
   * @returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * const error = new ApplicationError('Batch operation failed');
   * error.addMany([validationError, networkError]);
   * ```
   */
  addMany(issues: ReadonlyArray<Error | ErrorIssue | ApplicationError>): this {
    for (const issue of issues) {
      this.add(issue);
    }
    return this;
  }

  /**
   * Updates a single mutable field after construction.
   *
   * For metadata, this **replaces** the entire metadata object.
   * Use {@link ApplicationError.setMany} to merge metadata with existing values.
   *
   * @template Key - The field to update.
   * @param key - The field name.
   * @param value - The new value.
   * @returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * error.set('severity', 'fatal');
   * error.set('metadata', { userId: '1234' });
   * ```
   */
  set<Key extends keyof Contract.UpdatableErrorOptions>(
    key: Key,
    value: Contract.UpdatableErrorOptions[Key],
  ): this {
    (this as Record<string, unknown>)[key] = value;
    return this;
  }

  /**
   * Updates multiple mutable fields after construction.
   *
   * Useful for enriching errors with context as they bubble through layers,
   * or for hooks to adjust severity. Metadata is **merged** with existing values
   * rather than replaced, so multiple layers can safely enrich metadata independently.
   * Use {@link ApplicationError.set} for replace semantics on a single field.
   *
   * @param options - Partial set of mutable fields to update.
   * @returns `this` for fluent chaining.
   *
   * @example
   * ```ts
   * error.setMany({ severity: 'fatal', metadata: { userId: '1234' } });
   * ```
   */
  setMany(options: Partial<Contract.UpdatableErrorOptions>): this {
    if (options.code !== undefined) {
      this.code = options.code;
    }
    if (options.severity !== undefined) {
      this.severity = options.severity;
    }
    if (options.reference !== undefined) {
      this.reference = options.reference;
    }
    if (options.metadata !== undefined) {
      this.metadata = {...this.metadata, ...options.metadata};
    }
    return this;
  }

  /**
   * Removes all aggregated issues.
   *
   * @returns `this` for fluent chaining.
   */
  removeAll(): this {
    this.#issues = [];
    return this;
  }

  /**
   * Serializes this error into a plain JSON-compatible object.
   *
   * @param options - Controls stack trace inclusion and nesting depth.
   * @returns A serialized representation of this error.
   *
   * @example
   * ```ts
   * const json = error.toJSON({ includeStack: true, depth: 3 });
   * ```
   */
  toJSON({
    includeStack = false,
    depth = 5,
  }: Contract.ErrorSerializerOptions = {}): Contract.SerializedError {
    const serialized: Record<string, unknown> = {
      message: this.message,
      code: this.code,
      severity: this.severity,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };

    if (this.reference !== undefined) {
      serialized.reference = this.reference;
    }

    if (includeStack && this.stack) {
      serialized.stack = this.stack;
    }

    if (this.#issues.length > 0 && depth > 0) {
      serialized.issues = this.#issues.map((issue) =>
        issue.toJSON({includeStack, depth: depth - 1}),
      );
    }

    if (this.cause !== undefined && depth > 0) {
      if (ApplicationErrorGuard(this.cause)) {
        serialized.cause = this.cause.toJSON({includeStack, depth: depth - 1});
      } else {
        serialized.cause = ApplicationError.from(this.cause).toJSON({
          includeStack,
          depth: depth - 1,
        });
      }
    }

    return serialized as unknown as Contract.SerializedError;
  }
}
