import {describe, expect, it} from 'vitest';
import {globToRegex} from '../globToRegex';

describe('globToRegex', () => {
  it('should match exact strings without wildcards', () => {
    const regex = globToRegex('tool:started');

    expect(regex.test('tool:started')).toBe(true);
    expect(regex.test('tool:ended')).toBe(false);
  });

  it('should match strings with a single wildcard', () => {
    const regex = globToRegex('tool:*');

    expect(regex.test('tool:started')).toBe(true);
    expect(regex.test('tool:ended')).toBe(true);
    expect(regex.test('turn:started')).toBe(false);
  });

  it('should match strings with multiple wildcards', () => {
    const regex = globToRegex('tool:*.completed');

    expect(regex.test('tool:call.completed')).toBe(true);
    expect(regex.test('tool:call.subcall.completed')).toBe(true);
    expect(regex.test('tool:call.failed')).toBe(false);
  });

  it('should escape regular-expression special characters', () => {
    const regex = globToRegex('tool.call+done');

    expect(regex.test('tool.call+done')).toBe(true);
    expect(regex.test('toolxcallxdone')).toBe(false);
  });

  it('should escape curly braces literally', () => {
    const regex = globToRegex('event{3}name');

    expect(regex.test('event{3}name')).toBe(true);
    expect(regex.test('eventttname')).toBe(false);
  });

  it('should anchor matches to the full string', () => {
    const regex = globToRegex('tool:*');

    expect(regex.test('prefix tool:started suffix')).toBe(false);
  });

  it('should handle an empty glob', () => {
    const regex = globToRegex('');

    expect(regex.test('')).toBe(true);
    expect(regex.test('tool:started')).toBe(false);
  });

  it('should reuse the cached regular expression for the same glob', () => {
    const first = globToRegex('tool:*');
    const second = globToRegex('tool:*');

    expect(first).toBe(second);
  });
});
