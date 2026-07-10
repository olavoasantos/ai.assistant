import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';

/**
 * Whitespace trimming strategy.
 *
 * - `'start'` — trim leading whitespace only.
 * - `'end'` — trim trailing whitespace only.
 * - `'both'` — trim both leading and trailing whitespace.
 */
export type TrimMode = 'start' | 'end' | 'both';

/**
 * Trim whitespace from a string value.
 *
 * This is a **transform** rule — it always succeeds and returns the
 * trimmed string. It runs in the `'pre'` phase so whitespace is
 * removed before any validation rules execute.
 *
 * Extras: `{ mode }`
 *
 * @param mode - Which sides to trim. Defaults to `'both'`.
 */
export function trim(mode: TrimMode = 'both'): Rule<string, string> {
  return createRule<string, string>({
    name: 'trim',
    order: 'pre',
    extras: {mode},
    validate(value) {
      switch (mode) {
        case 'start':
          return Ok(value.trimStart());
        case 'end':
          return Ok(value.trimEnd());
        case 'both':
          return Ok(value.trim());
      }
    },
  });
}
