import type {Rule, ValidationOptions} from '@ai.assistant/contracts/validation';
import {createRule} from '../custom/rule';
import {Ok} from '../utilities/Ok';
import {Err} from '../utilities/Err';

/**
 * Create a boolean validator.
 *
 * Validates that the input is a JavaScript boolean and then runs any
 * provided sub-rules.
 *
 * @template Output - The output type, defaults to `boolean`.
 * @param rules - Optional array of boolean rules to execute after the type check.
 * @param options - Optional schema-level default options.
 */
export function boolean<Output extends boolean = boolean>(
  rules?: readonly Rule<Output>[],
  options?: ValidationOptions,
): Rule<unknown, Output> {
  return createRule<unknown, Output>({
    name: 'boolean',
    rules,
    options,
    validate(value) {
      return typeof value === 'boolean' ? Ok(value as Output) : Err();
    },
  });
}
