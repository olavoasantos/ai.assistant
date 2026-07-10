/**
 * Checks whether a value is a plain record (a non-null, non-array object).
 *
 * Useful for runtime type narrowing when validating unknown inputs.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a non-null, non-array object.
 *
 * @example
 * ```ts
 * RecordGuard({a: 1});            // true
 * RecordGuard(Object.create(null)); // true
 * RecordGuard([1, 2]);            // false
 * RecordGuard(null);              // false
 * ```
 */
export function RecordGuard(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
