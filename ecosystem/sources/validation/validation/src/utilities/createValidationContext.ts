import type {ValidationContext, ValidationOptions} from '@ai.assistant/contracts/validation';

/**
 * Create the root validation context for a validation pass.
 *
 * @param value - The top-level value being validated. Used as both
 *   `root` and the initial validation target.
 * @param options - Merged validation options for this pass.
 * @returns A fresh validation context.
 */
export function createValidationContext(
  value: unknown,
  options: ValidationOptions,
): ValidationContext {
  return {
    options,
    root: value,
    parent: undefined,
    path: [],
    key: undefined,
  };
}
