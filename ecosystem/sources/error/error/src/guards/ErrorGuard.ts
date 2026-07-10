/**
 * Checks whether an unknown value is an `Error` instance.
 *
 * @param value - The value to check.
 * @returns `true` if the value is an `Error` instance.
 *
 * @example
 * ```ts
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   if (ErrorGuard(error)) {
 *     // error is narrowed to Error
 *   }
 * }
 * ```
 */
export function ErrorGuard(value: unknown): value is Error {
  return value instanceof Error;
}
