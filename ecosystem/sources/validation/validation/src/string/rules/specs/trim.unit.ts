import {describe, expect, it} from 'vitest';
import {trim} from '../trim';

describe('trim', () => {
  it('trims both sides by default', () => {
    const rule = trim();
    const result = rule.validate('  hello  ');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('trims only leading whitespace in start mode', () => {
    const rule = trim('start');
    const result = rule.validate('  hello  ');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello  ');
  });

  it('trims only trailing whitespace in end mode', () => {
    const rule = trim('end');
    const result = rule.validate('  hello  ');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('  hello');
  });

  it('always succeeds', () => {
    const rule = trim();
    const result = rule.validate('');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('');
  });

  it('has order pre', () => {
    const rule = trim();

    expect(rule.order).toBe('pre');
  });

  it('returns the trimmed value in result.value', () => {
    const rule = trim();
    const result = rule.validate('  spaced  ');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('spaced');
  });
});
