import type {Rule, ValidationOptions} from '@ai.assistant/contracts/validation';
import {createRule} from '../custom/rule';
import {Ok} from '../utilities/Ok';
import {Err} from '../utilities/Err';

/**
 * Create a number validator.
 *
 * Validates that the input is a JavaScript number and is not `NaN`,
 * then runs any provided sub-rules (e.g. `min(0)`, `max(100)`).
 *
 * @template Output - The output type, defaults to `number`.
 * @param rules - Optional array of number rules to execute after the type check.
 * @param options - Optional schema-level default options.
 */
export function number<Output extends number = number>(
  rules?: readonly Rule<Output>[],
  options?: ValidationOptions,
): Rule<unknown, Output> {
  return createRule<unknown, Output>({
    name: 'number',
    rules,
    options,
    validate(value) {
      return typeof value === 'number' && !Number.isNaN(value) ? Ok(value as Output) : Err();
    },
  });
}
