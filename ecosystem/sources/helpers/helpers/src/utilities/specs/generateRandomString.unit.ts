import {describe, it, expect} from 'vitest';
import {generateRandomString} from '../generateRandomString';

describe('generateRandomString', () => {
  it('should generate a string of the specified size', () => {
    const result = generateRandomString(16);

    expect(result).toHaveLength(16);
  });

  it('should default to a length of 8 when no size is provided', () => {
    const result = generateRandomString();

    expect(result).toHaveLength(8);
  });

  it('should generate strings containing only alphanumeric characters', () => {
    const result = generateRandomString(100);

    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it('should generate unique strings on successive calls', () => {
    const results = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      results.add(generateRandomString(16));
    }

    expect(results.size).toBe(1000);
  });

  it('should clamp size to a minimum of 1', () => {
    const resultZero = generateRandomString(0);
    const resultNegative = generateRandomString(-5);

    expect(resultZero).toHaveLength(1);
    expect(resultNegative).toHaveLength(1);
  });

  it('should handle large sizes correctly', () => {
    const result = generateRandomString(256);

    expect(result).toHaveLength(256);
    expect(result).toMatch(/^[a-z0-9]+$/);
  });

  it('should return a string of exactly size 1 when size is 1', () => {
    const result = generateRandomString(1);

    expect(result).toHaveLength(1);
    expect(result).toMatch(/^[a-z0-9]$/);
  });
});
