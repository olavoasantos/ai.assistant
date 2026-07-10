import type {Rule, ValidationOptions} from '@ai.assistant/contracts/validation';
import {createRule} from '../custom/rule';
import {Ok} from '../utilities/Ok';
import {Err} from '../utilities/Err';

/**
 * Create a string validator.
 *
 * Validates that the input is a JavaScript string and then runs any
 * provided sub-rules (e.g. `email()`, `minLength(3)`).
 *
 * @template Output - The output type, defaults to `string`.
 * @param rules - Optional array of string rules to execute after the type check.
 * @param options - Optional schema-level default options.
 */
export function string<Output extends string = string>(
  rules?: readonly Rule<Output>[],
  options?: ValidationOptions,
): Rule<unknown, Output> {
  return createRule<unknown, Output>({
    name: 'string',
    rules,
    options,
    validate(value) {
      return typeof value === 'string' ? Ok(value as Output) : Err();
    },
  });
}
