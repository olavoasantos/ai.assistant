import {describe, expect, it} from 'vitest';
import {max} from '../max';

describe('max', () => {
  it('passes numbers less than the limit', () => {
    const rule = max(10);
    const result = rule.validate(5);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(5);
  });

  it('passes numbers exactly at the limit', () => {
    const rule = max(10);
    const result = rule.validate(10);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(10);
  });

  it('fails numbers greater than the limit', () => {
    const rule = max(10);
    const result = rule.validate(15);

    expect(result.ok).toBe(false);
  });

  it('includes max in issue extras', () => {
    const rule = max(5);
    const result = rule.validate(10);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.extras).toEqual({max: 5});
  });
});
