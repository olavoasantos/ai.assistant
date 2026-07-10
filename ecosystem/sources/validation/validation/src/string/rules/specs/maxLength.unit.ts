import {describe, expect, it} from 'vitest';
import {maxLength} from '../maxLength';

describe('maxLength', () => {
  it('passes strings shorter than the maximum', () => {
    const rule = maxLength(5);
    const result = rule.validate('hi');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hi');
  });

  it('passes strings exactly at the maximum length', () => {
    const rule = maxLength(5);
    const result = rule.validate('hello');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('fails strings longer than the maximum', () => {
    const rule = maxLength(5);
    const result = rule.validate('hello world');

    expect(result.ok).toBe(false);
  });

  it('includes max in issue extras', () => {
    const rule = maxLength(3);
    const result = rule.validate('hello');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.extras).toEqual({max: 3});
  });
});
