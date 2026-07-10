import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

/**
 * Require a number to be less than or equal to `limit`.
 *
 * Extras: `{ max }`
 *
 * @param limit - The maximum allowed value (inclusive).
 */
export function max(limit: number): Rule<number, number> {
  return createRule<number, number>({
    name: 'max',
    extras: {max: limit},
    validate(value) {
      return value <= limit ? Ok(value) : Err();
    },
  });
}
