import {describe, expect, it} from 'vitest';
import {min} from '../min';

describe('min', () => {
  it('passes numbers greater than the limit', () => {
    const rule = min(5);
    const result = rule.validate(10);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(10);
  });

  it('passes numbers exactly at the limit', () => {
    const rule = min(5);
    const result = rule.validate(5);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(5);
  });

  it('fails numbers less than the limit', () => {
    const rule = min(5);
    const result = rule.validate(3);

    expect(result.ok).toBe(false);
  });

  it('includes min in issue extras', () => {
    const rule = min(10);
    const result = rule.validate(5);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.extras).toEqual({min: 10});
  });
});
