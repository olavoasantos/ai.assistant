import {describe, expect, it} from 'vitest';
import {Executable} from '../../classes/Executable';
import {EXECUTABLE_IDENTIFIER} from '../../constants';
import {ExecutableGuard} from '../ExecutableGuard';

describe('ExecutableGuard', () => {
  it('accepts a branded executable', () => {
    expect(ExecutableGuard.is(new Executable())).toBe(true);
  });

  it('rejects an unbranded structural look-alike', () => {
    expect(ExecutableGuard.is({status: 'created', initialize: async () => undefined})).toBe(false);
  });

  it('accepts the shared global brand without relying on instanceof', () => {
    expect(ExecutableGuard.is({[EXECUTABLE_IDENTIFIER]: true})).toBe(true);
  });
});
