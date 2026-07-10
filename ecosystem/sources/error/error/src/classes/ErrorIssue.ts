import type * as Contracts from '@ai.assistant/contracts/error';
import {ERROR_ISSUE_IDENTIFIER} from '../constants';
import {ErrorIssueGuard} from '../guards/ErrorIssueGuard';
import {ApplicationErrorGuard} from '../guards/ApplicationErrorGuard';
import {ErrorGuard} from '../guards/ErrorGuard';

/**
 * A lightweight data class representing a sub-problem within an {@link ApplicationError}.
 *
 * Issues describe individual problems that contributed to a parent error being thrown.
 * Their shape is compatible with the Standard Schema `Issue` convention (`message` + optional `path`),
 * making them interoperable with validation libraries like Zod, Valibot, and ArkType.
 *
 * Use the static {@link ErrorIssue.from} method to normalize `Error`, `ApplicationError`,
 * or existing `ErrorIssue` instances into a consistent shape.
 *
 * @example
 * ```ts
 * // Direct construction
 * const issue = new ErrorIssue({ message: 'Invalid email', path: ['user', 'email'] });
 *
 * // Normalization from a caught error
 * const issue = ErrorIssue.from(caughtError);
 * ```
 */
export class ErrorIssue implements Contracts.ErrorIssue {
  /**
   * Normalizes a value into an `ErrorIssue`.
   *
   * - If the value is already an `ErrorIssue`, it is returned as-is.
   * - If the value is an `ApplicationError` or `Error`, a new `ErrorIssue` is created
   *   with the error's message and the original error stored as `cause`.
   *
   * @param value - The error to normalize.
   * @returns An `ErrorIssue` instance.
   *
   * @example
   * ```ts
   * try {
   *   await validateField(input);
   * } catch (error) {
   *   parentError.push(ErrorIssue.from(error));
   * }
   * ```
   */
  static from(value: Error | Contracts.ErrorIssue): ErrorIssue {
    if (ErrorIssueGuard(value)) {
      return value;
    }

    return new ErrorIssue({
      message: value.message,
      cause: value,
    });
  }

  /** The human-readable description of this issue. */
  readonly message: string;

  /**
   * The path to the value that caused this issue.
   * Compatible with the Standard Schema `Issue.path` convention.
   */
  readonly path?: ReadonlyArray<PropertyKey>;

  /** The underlying cause of this issue, typically the original error. */
  readonly cause?: unknown;

  /** @internal Symbol brand for cross-boundary identification. */
  readonly [ERROR_ISSUE_IDENTIFIER] = true;

  /**
   * Creates a new `ErrorIssue`.
   *
   * @param options - The issue details.
   */
  constructor(options: Contracts.ErrorIssueOptions) {
    this.message = options.message;
    this.path = options.path;
    this.cause = options.cause;
  }

  /**
   * Serializes this issue into a plain JSON-compatible object.
   *
   * When the `cause` is an `ApplicationError`, it is serialized via its own `toJSON` method.
   * When it is a plain `Error`, it is serialized with message and optional stack.
   * Non-error causes are omitted from the output.
   *
   * @param options - Serialization options controlling stack inclusion and depth.
   * @returns A serialized representation of this issue.
   */
  toJSON({
    includeStack = false,
    depth = 5,
  }: Contracts.ErrorSerializerOptions = {}): Contracts.SerializedErrorIssue {
    const serialized: Record<string, unknown> = {
      message: this.message,
    };

    if (this.path !== undefined) {
      serialized.path = this.path;
    }

    if (this.cause != null && depth > 0) {
      if (ApplicationErrorGuard(this.cause) || ErrorIssueGuard(this.cause)) {
        serialized.cause = this.cause.toJSON({includeStack, depth: depth - 1});
      } else if (ErrorGuard(this.cause)) {
        const causeSerialized: Record<string, unknown> = {message: this.cause.message};
        if (includeStack && this.cause.stack) {
          causeSerialized.stack = this.cause.stack;
        }
        serialized.cause = causeSerialized;
      }
    }

    return serialized as unknown as Contracts.SerializedErrorIssue;
  }
}
