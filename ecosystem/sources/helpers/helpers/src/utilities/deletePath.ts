/**
 * Deletes a key from a nested object at a dot-separated path.
 *
 * Walks the object tree and removes the final key using `delete`.
 * No-op if any intermediate segment is missing or not an object.
 *
 * @param target - The object to mutate.
 * @param path - A dot-separated path string (e.g. `'a.b.c'`).
 *
 * @example
 * ```ts
 * const obj = {a: {b: {c: 42}}};
 * deletePath(obj, 'a.b.c');
 * // obj is now {a: {b: {}}}
 * ```
 */
export function deletePath(target: Record<string, any>, path: string): void {
  const segments = path.split('.');
  let current: unknown = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return;
    }

    current = (current as Record<string, any>)[segments[index]];
  }

  if (current === null || current === undefined || typeof current !== 'object') {
    return;
  }

  delete (current as Record<string, any>)[segments[segments.length - 1]];
}
