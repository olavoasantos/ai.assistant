import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

/**
 * Require a number to be greater than or equal to `limit`.
 *
 * Extras: `{ min }`
 *
 * @param limit - The minimum allowed value (inclusive).
 */
export function min(limit: number): Rule<number, number> {
  return createRule<number, number>({
    name: 'min',
    extras: {min: limit},
    validate(value) {
      return value >= limit ? Ok(value) : Err();
    },
  });
}
