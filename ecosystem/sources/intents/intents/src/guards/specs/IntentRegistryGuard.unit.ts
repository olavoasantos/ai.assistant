import {describe, expect, it} from 'vitest';
import {INTENT_REGISTRY_IDENTIFIER} from '../../constants';
import {IntentRegistryGuard} from '../IntentRegistryGuard';

describe('IntentRegistryGuard', () => {
  it('accepts the shared global brand', () => {
    expect(IntentRegistryGuard.is({[INTENT_REGISTRY_IDENTIFIER]: true})).toBe(true);
  });

  it('rejects unbranded values', () => {
    expect(IntentRegistryGuard.is({})).toBe(false);
  });
});
