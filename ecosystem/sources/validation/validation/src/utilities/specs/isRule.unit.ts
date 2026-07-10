import {describe, expect, it} from 'vitest';
import {isRule} from '../isRule';
import {createRule} from '../../custom/rule';
import {Ok} from '../Ok';

describe('isRule', () => {
  it('returns true for a rule created by createRule', () => {
    const rule = createRule({name: 'test', validate: () => Ok()});

    expect(isRule(rule)).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isRule({name: 'test'})).toBe(false);
  });

  it('returns false for a function', () => {
    expect(isRule(() => {})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRule(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRule(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isRule('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isRule(42)).toBe(false);
  });
});
