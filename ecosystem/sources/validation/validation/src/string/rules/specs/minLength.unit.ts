import {describe, expect, it} from 'vitest';
import {minLength} from '../minLength';

describe('minLength', () => {
  it('passes strings longer than the minimum', () => {
    const rule = minLength(3);
    const result = rule.validate('hello');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('passes strings exactly at the minimum length', () => {
    const rule = minLength(3);
    const result = rule.validate('abc');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('abc');
  });

  it('fails strings shorter than the minimum', () => {
    const rule = minLength(3);
    const result = rule.validate('ab');

    expect(result.ok).toBe(false);
  });

  it('includes min in issue extras', () => {
    const rule = minLength(5);
    const result = rule.validate('hi');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.extras).toEqual({min: 5});
  });
});
