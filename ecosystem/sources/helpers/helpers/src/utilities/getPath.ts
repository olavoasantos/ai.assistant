import type {PathsOf, PathValue} from '../types/DotNotation';

/**
 * Retrieves a nested value from an object at a dot-or-bracket path.
 *
 * Supports dot notation (`'user.profile.name'`) and bracket notation
 * (`'items[0].name'`). Returns `undefined` when any segment is missing
 * or not an object — never throws for missing paths.
 *
 * @template T - The object type.
 * @template P - A dot-notation path compatible with {@link PathsOf}.
 * @param obj - The object to traverse.
 * @param path - A dot-or-bracket path string.
 * @returns The value at the path, or `undefined`.
 *
 * @example
 * ```ts
 * const data = {user: {profile: {name: 'Ada'}}};
 * getPath(data, 'user.profile.name'); // → 'Ada'
 * getPath(data, 'user.profile.email'); // → undefined
 * ```
 */
export function getPath<T, P extends PathsOf<T>>(obj: T, path: P): PathValue<T, P> | undefined {
  if (path === '') return obj as PathValue<T, P>;

  let result: any = obj;
  const keys = (path as string).split(/[.[\]]/).filter(Boolean);

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }

  return result;
}
