import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

/**
 * Require a string to be at least `min` characters long.
 *
 * Extras: `{ min }`
 *
 * @param min - Minimum number of characters (inclusive).
 */
export function minLength(min: number): Rule<string, string> {
  return createRule<string, string>({
    name: 'minLength',
    extras: {min},
    validate(value) {
      return value.length >= min ? Ok(value) : Err();
    },
  });
}
