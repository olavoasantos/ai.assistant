import type {
  Issue,
  Result,
  Rule,
  Traverser,
  ValidationContext,
} from '@ai.assistant/contracts/validation';
import type {InternalValidationOptions} from '../types';
import {createChildContext} from '../utilities/createChildContext';

/**
 * Shape definition for an object validator.
 *
 * Maps property keys to the validators responsible for each property's
 * value.
 */
export type Shape = Record<PropertyKey, Rule>;

/**
 * Options controlling how an object traversal handles extra properties.
 */
export interface TraverseObjectOptions {
  /** How to handle properties not declared in the shape. */
  readonly extraProperties?: 'strip' | 'reject' | 'passthrough';
}

/**
 * Create a traversal function for object validation.
 *
 * The returned {@link Traverser} iterates all input keys, validates
 * shape-declared keys against their corresponding validators, and handles
 * non-shape keys according to the `extraProperties` mode. Nested issues
 * are prepended with the property key as a path segment.
 *
 * @param shape - A mapping of property keys to validators.
 * @param options - Controls for extra property handling.
 * @returns A {@link Traverser} suitable for use in a `createRule` descriptor.
 */
export function traverseObject<Output extends Record<PropertyKey, unknown>>(
  shape: Shape,
  options?: TraverseObjectOptions,
): Traverser<Record<PropertyKey, unknown>, Output> {
  const shapeKeys = new Set<PropertyKey>(Reflect.ownKeys(shape));
  const extraProperties = options?.extraProperties ?? 'strip';

  return (value: Record<PropertyKey, unknown>, context: ValidationContext): Result<Output> => {
    const allIssues: Issue[] = [];
    const output: Record<PropertyKey, unknown> = {};

    for (const key of shapeKeys) {
      const validator = shape[key];
      const childContext = createChildContext(context, value, key);
      const childOptions: InternalValidationOptions = {
        ...context.options,
        _context: childContext,
      };
      const result = validator.validate(value[key], childOptions);

      if (result.ok) {
        output[key] = result.value;
      } else {
        for (const issue of result.issues) {
          allIssues.push({
            ...issue,
            path: [key, ...(issue.path ?? [])],
          });
        }
        if (context.options.bail) break;
      }
    }

    if (!(allIssues.length > 0 && context.options.bail)) {
      for (const key of Reflect.ownKeys(value)) {
        if (shapeKeys.has(key)) continue;

        if (extraProperties === 'reject') {
          allIssues.push({
            message: 'validation.object.extraProperty',
            rule: 'object',
            extras: {key: String(key)},
            path: [key],
          });
          if (context.options.bail) break;
        } else if (extraProperties === 'passthrough') {
          output[key] = value[key];
        }
      }
    }

    if (allIssues.length > 0) {
      return {ok: false, value: undefined, issues: allIssues};
    }

    return {ok: true, value: output as Output, issues: undefined};
  };
}
