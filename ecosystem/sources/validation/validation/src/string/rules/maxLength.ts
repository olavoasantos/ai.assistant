import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

/**
 * Require a string to be at most `max` characters long.
 *
 * Extras: `{ max }`
 *
 * @param max - Maximum number of characters (inclusive).
 */
export function maxLength(max: number): Rule<string, string> {
  return createRule<string, string>({
    name: 'maxLength',
    extras: {max},
    validate(value) {
      return value.length <= max ? Ok(value) : Err();
    },
  });
}
