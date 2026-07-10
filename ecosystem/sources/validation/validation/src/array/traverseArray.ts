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
 * Create a traversal function for array validation.
 *
 * The returned {@link Traverser} iterates all elements of the input
 * array and validates each against the provided item schema. Nested
 * issues carry numeric path segments corresponding to the element
 * index.
 *
 * @template T - The expected element type.
 * @param itemSchema - The validator to apply to each array element.
 * @returns A {@link Traverser} suitable for use in a `createRule` descriptor.
 */
export function traverseArray<T>(itemSchema: Rule<unknown, T>): Traverser<unknown[], T[]> {
  return (value: unknown[], context: ValidationContext): Result<T[]> => {
    const allIssues: Issue[] = [];
    const output: T[] = [];

    for (let i = 0; i < value.length; i++) {
      const childContext = createChildContext(context, value, i);
      const childOptions: InternalValidationOptions = {
        ...context.options,
        _context: childContext,
      };
      const result = itemSchema.validate(value[i], childOptions);

      if (result.ok) {
        output.push(result.value);
      } else {
        for (const issue of result.issues) {
          allIssues.push({
            ...issue,
            path: [i, ...(issue.path ?? [])],
          });
        }
        if (context.options.bail) break;
      }
    }

    if (allIssues.length > 0) {
      return {ok: false, value: undefined, issues: allIssues};
    }

    return {ok: true, value: output, issues: undefined};
  };
}
