/**
 * Error domain types.
 *
 * Defines the structured error system used throughout the platform.
 * Errors carry numeric codes (HTTP status code convention), severity
 * levels, extensible metadata, and optional sub-issues for
 * validation-style errors.
 */
import type {ErrorMetadata} from '..';
import type {Timestamp} from '../utilities';

export type {ErrorMetadata} from '..';

/**
 * Severity level indicating how the receiver should handle an error.
 *
 * - `'recoverable'` — the caller can retry or continue with degraded behavior.
 * - `'fatal'` — the error is unrecoverable; the caller should stop.
 */
export type ErrorSeverity = 'recoverable' | 'fatal';

/**
 * Options for constructing an {@link ApplicationError}.
 *
 * When only a `message` is provided, all other fields receive defaults.
 */
export interface ErrorOptions {
  /** A human-readable description of the error. */
  readonly message: string;

  /**
   * Numeric error code using HTTP status code values as a widely-known convention.
   *
   * @defaultValue 500
   */
  readonly code?: number;

  /**
   * Severity level controlling how the framework handles this error.
   *
   * @defaultValue 'recoverable'
   */
  readonly severity?: ErrorSeverity;

  /** An optional string reference for traceability. */
  readonly reference?: string;

  /** Arbitrary metadata providing additional error context. */
  readonly metadata?: ErrorMetadata;

  /**
   * The underlying cause of this error, aligned with the ES2022
   * `Error.cause` convention.
   */
  readonly cause?: unknown;
}

/**
 * Fields of an {@link ApplicationError} that can be mutated after
 * construction via the `set()` method.
 */
export interface UpdatableErrorOptions {
  /** Numeric error code. */
  readonly code: number;
  /** Severity level. */
  readonly severity: ErrorSeverity;
  /** String reference for traceability. */
  readonly reference: string;
  /**
   * Arbitrary metadata. Merged with existing metadata when passed
   * to `setMany()`.
   */
  readonly metadata: ErrorMetadata;
}

/**
 * Options for constructing an {@link ErrorIssue}.
 */
export interface ErrorIssueOptions {
  /** A human-readable description of the issue. */
  readonly message: string;

  /**
   * The location within a nested structure where the issue originated.
   * Each element represents a property key traversed to reach the
   * problematic value.
   */
  readonly path?: readonly PropertyKey[];

  /** The underlying cause of this issue. */
  readonly cause?: unknown;
}

/**
 * Options controlling how errors are serialized to JSON.
 */
export interface ErrorSerializerOptions {
  /**
   * Whether to include stack traces in the serialized output.
   *
   * @defaultValue false
   */
  readonly includeStack?: boolean;

  /**
   * Maximum depth for serializing nested issues and causes.
   * Prevents infinite recursion in deep error trees.
   *
   * @defaultValue 5
   */
  readonly depth?: number;
}

/**
 * JSON-serializable representation of an {@link ErrorIssue}.
 */
export interface SerializedErrorIssue {
  /** Human-readable description of this issue. */
  readonly message: string;
  /** Path to the value that caused the issue. */
  readonly path?: readonly PropertyKey[];
  /** Serialized cause, if any. */
  readonly cause?: SerializedError | SerializedErrorIssue;
  /** Stack trace, included only when requested via serializer options. */
  readonly stack?: string;
}

/**
 * JSON-serializable error representation for the protocol.
 *
 * Uses HTTP status codes as a widely-known convention for the numeric
 * code. Carries severity, structured metadata, and optional sub-issues
 * for validation-style errors.
 */
export interface SerializedError {
  /** Human-readable error message. */
  readonly message: string;
  /** Numeric error code using HTTP status code values. */
  readonly code: number;
  /** Severity level. */
  readonly severity: ErrorSeverity;
  /** Optional string reference for traceability. */
  readonly reference?: string;
  /** Arbitrary metadata providing additional context. */
  readonly metadata: ErrorMetadata;
  /** ISO 8601 timestamp of when the error was created. */
  readonly timestamp: Timestamp;
  /** Stack trace, included only when requested via serializer options. */
  readonly stack?: string;
  /** Serialized sub-issues, if any. */
  readonly issues?: readonly SerializedErrorIssue[];
  /** Serialized cause, if any. */
  readonly cause?: SerializedError;
}

/**
 * A lightweight issue representing a sub-problem within an
 * {@link ApplicationError}.
 *
 * Each issue captures a single validation or processing failure with
 * a human-readable message and an optional path to the offending value.
 */
export interface ErrorIssue {
  /** The human-readable description of this issue. */
  readonly message: string;
  /** The path to the value that caused this issue. */
  readonly path?: readonly PropertyKey[];
  /** The underlying cause of this issue. */
  readonly cause?: unknown;

  /**
   * Serializes this issue into a plain JSON-compatible object.
   *
   * @param options - Serialization options controlling stack
   *   inclusion and depth.
   */
  toJSON(options?: ErrorSerializerOptions): SerializedErrorIssue;
}

/**
 * Contract for the structured error class used throughout the platform.
 *
 * Extends the native `Error` with severity, numeric code, metadata,
 * issue aggregation, and serialization capabilities.
 *
 * @example Creating and enriching an error:
 * ```typescript
 * const error = new ApplicationError({ message: 'Not found', code: 404 });
 * error.set('reference', 'session-123').set('severity', 'fatal');
 * ```
 *
 * @example Aggregating validation issues:
 * ```typescript
 * const error = new ApplicationError({ message: 'Validation failed', code: 400 });
 * error.add({ message: 'name is required', path: ['name'] });
 * error.add({ message: 'age must be positive', path: ['age'] });
 * ```
 */
export interface ApplicationError extends Error {
  /** Numeric error code using HTTP status code values. */
  code: number;
  /** Severity level controlling how the framework handles this error. */
  severity: ErrorSeverity;
  /** Optional string reference for traceability. */
  reference?: string;
  /** Arbitrary metadata providing additional error context. */
  metadata: ErrorMetadata;
  /** ISO 8601 timestamp of when the error was created. */
  readonly timestamp: Timestamp;
  /** The aggregated issues collected via {@link add}. */
  readonly issues: readonly ErrorIssue[];
  /** Whether this error has any aggregated issues. */
  readonly hasIssues: boolean;

  /**
   * Adds a single error as an issue into this error's aggregation.
   *
   * @returns `this` for fluent chaining.
   */
  add(issue: Error | ErrorIssue): this;

  /**
   * Adds multiple errors as issues into this error's aggregation.
   *
   * @returns `this` for fluent chaining.
   */
  addMany(issues: readonly (Error | ErrorIssue)[]): this;

  /**
   * Updates a single mutable field after construction.
   *
   * For metadata, this **replaces** the entire metadata object.
   * Use {@link setMany} to merge metadata with existing values.
   *
   * @returns `this` for fluent chaining.
   */
  set<Key extends keyof UpdatableErrorOptions>(key: Key, value: UpdatableErrorOptions[Key]): this;

  /**
   * Updates multiple mutable fields after construction.
   *
   * Metadata is **merged** with existing values rather than replaced.
   * Use {@link set} for replace semantics on a single field.
   *
   * @returns `this` for fluent chaining.
   */
  setMany(options: Partial<UpdatableErrorOptions>): this;

  /**
   * Removes all aggregated issues.
   *
   * @returns `this` for fluent chaining.
   */
  removeAll(): this;

  /**
   * Serializes this error into a plain JSON-compatible object.
   *
   * @param options - Controls stack trace inclusion and nesting depth.
   */
  toJSON(options?: ErrorSerializerOptions): SerializedError;
}
