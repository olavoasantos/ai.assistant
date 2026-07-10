import type {ApplicationError} from '../classes/ApplicationError';
import {APPLICATION_ERROR_IDENTIFIER} from '../constants';

/**
 * Checks whether an unknown value is an {@link ApplicationError}.
 *
 * Uses a Symbol brand for identification, making it reliable across module boundaries,
 * package versions, and JavaScript realms — unlike `instanceof` checks which can fail
 * when multiple copies of the package exist.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `ApplicationError` instance.
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   if (ApplicationErrorGuard(error)) {
 *     // error is narrowed to ApplicationError
 *   }
 * }
 * ```
 */
export function ApplicationErrorGuard(value: unknown): value is ApplicationError {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    APPLICATION_ERROR_IDENTIFIER in value &&
    value[APPLICATION_ERROR_IDENTIFIER] === true
  );
}
