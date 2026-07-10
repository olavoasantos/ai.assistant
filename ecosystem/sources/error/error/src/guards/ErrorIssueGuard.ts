import type {ErrorIssue} from '../classes/ErrorIssue';
import {ERROR_ISSUE_IDENTIFIER} from '../constants';

/**
 * Checks whether an unknown value is an {@link ErrorIssue}.
 *
 * Uses a Symbol brand for identification, making it reliable across module boundaries,
 * package versions, and JavaScript realms.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `ErrorIssue` instance.
 *
 * @example
 * ```ts
 * if (ErrorIssueGuard(value)) {
 *   // value is narrowed to ErrorIssue
 * }
 * ```
 */
export function ErrorIssueGuard(value: unknown): value is ErrorIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    ERROR_ISSUE_IDENTIFIER in value &&
    value[ERROR_ISSUE_IDENTIFIER] === true
  );
}
