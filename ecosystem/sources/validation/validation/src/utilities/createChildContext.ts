import type {ValidationContext} from '@ai.assistant/contracts/validation';

/**
 * Create a child validation context for a nested property or element.
 *
 * Traversal functions call this before validating each child so that
 * the child's `validate` receives the correct `parent`, `path`,
 * and `key` values. The `root` and `options` are inherited from
 * the parent context.
 *
 * @param context - The parent's validation context.
 * @param parent - The immediate containing value (object, array, etc.).
 * @param key - The property key or index of this child.
 * @returns A child validation context.
 */
export function createChildContext(
  context: ValidationContext,
  parent: unknown,
  key: PropertyKey,
): ValidationContext {
  return {
    options: context.options,
    root: context.root,
    parent,
    path: [...context.path, key],
    key,
  };
}
