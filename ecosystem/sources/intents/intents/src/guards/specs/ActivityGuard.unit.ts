import {describe, expect, it} from 'vitest';
import {ACTIVITY_IDENTIFIER} from '../../constants';
import {ActivityGuard} from '../ActivityGuard';

describe('ActivityGuard', () => {
  it('accepts the shared global brand without relying on instanceof', () => {
    expect(ActivityGuard.is({[ACTIVITY_IDENTIFIER]: true})).toBe(true);
  });

  it('rejects unbranded values', () => {
    expect(ActivityGuard.is({})).toBe(false);
    expect(ActivityGuard.is(null)).toBe(false);
  });
});
