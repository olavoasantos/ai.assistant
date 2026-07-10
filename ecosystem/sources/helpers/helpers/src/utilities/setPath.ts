/**
 * Sets a nested value on an object at a pre-split path.
 *
 * Creates intermediate objects as needed. Overwrites non-object intermediates
 * with fresh objects. No-op when the target is not an object or is an array.
 *
 * @template T - The object type.
 * @param obj - The object to mutate.
 * @param path - A pre-split path array (e.g. `['a', 'b', 'c']`).
 * @param value - The value to set at the path.
 *
 * @example
 * ```ts
 * const target: Record<string, unknown> = {};
 * setPath(target, ['a', 'b', 'c'], 42);
 * // target is now {a: {b: {c: 42}}}
 * ```
 */
export function setPath<T extends Record<any, any>>(
  obj: T,
  [part, ...parts]: string[],
  value: unknown,
): void {
  if (!part || typeof obj !== 'object' || obj == null || Array.isArray(obj)) {
    return;
  }

  if (parts.length === 0) {
    obj[part as keyof T] = value as T[keyof T];
    return;
  }

  if (typeof obj[part] !== 'object' || obj[part] == null || Array.isArray(obj[part])) {
    obj[part as keyof T] = {} as T[keyof T];
  }

  return setPath(obj[part], parts, value);
}
