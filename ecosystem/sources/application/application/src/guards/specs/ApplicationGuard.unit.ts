import {describe, expect, it} from 'vitest';
import {Application} from '../../classes/Application';
import {APPLICATION_IDENTIFIER} from '../../constants';
import {ApplicationGuard} from '../ApplicationGuard';

describe('ApplicationGuard', () => {
  it('accepts an application instance', () => {
    expect(ApplicationGuard.is(new Application())).toBe(true);
  });

  it('rejects an unbranded structural look-alike', () => {
    expect(ApplicationGuard.is({status: 'created', initialize: async () => undefined})).toBe(false);
  });

  it('accepts the shared global brand without relying on instanceof', () => {
    expect(ApplicationGuard.is({[APPLICATION_IDENTIFIER]: true})).toBe(true);
  });
});
