import {describe, expect, it} from 'vitest';
import {INTENT_IDENTIFIER} from '../../constants';
import {IntentGuard} from '../IntentGuard';

describe('IntentGuard', () => {
  it('accepts the shared global brand', () => {
    expect(IntentGuard.is({[INTENT_IDENTIFIER]: true})).toBe(true);
  });

  it('rejects unbranded values', () => {
    expect(IntentGuard.is({})).toBe(false);
  });
});
