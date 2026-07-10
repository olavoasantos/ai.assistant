import type {Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Require a string to match a pragmatic email format.
 *
 * Uses a pattern that covers the vast majority of real-world addresses
 * without attempting full RFC 5322 compliance.
 */
export function email(): Rule<string, string> {
  return createRule<string, string>({
    name: 'email',
    validate(value) {
      return EMAIL_PATTERN.test(value) ? Ok(value) : Err();
    },
  });
}
