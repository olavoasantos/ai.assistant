import {describe, expect, it} from 'vitest';
import {executeRules} from '../executeRules';
import {createRule} from '../../custom/rule';
import {Ok} from '../Ok';
import {Err} from '../Err';
import type {ValidationContext} from '@ai.assistant/contracts/validation';

function createContext(value: unknown, bail = false): ValidationContext {
  return {options: {bail}, root: value, parent: undefined, path: [], key: undefined};
}

describe('executeRules', () => {
  it('returns success with original value when rules array is empty', () => {
    const result = executeRules('hello', [], createContext('hello'), 'test');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('threads output value from one passing rule to the next', () => {
    const double = createRule<number>({
      name: 'double',
      validate: (v) => Ok(v * 2),
    });
    const addOne = createRule<number>({
      name: 'addOne',
      validate: (v) => Ok(v + 1),
    });

    const result = executeRules(5, [double, addOne], createContext(5), 'math');

    expect(result.ok).toBe(true);
    expect(result.value).toBe(11);
  });

  it('accumulates issues from multiple failing rules', () => {
    const failA = createRule({
      name: 'failA',
      validate: () => Err({message: 'error A'}),
    });
    const failB = createRule({
      name: 'failB',
      validate: () => Err({message: 'error B'}),
    });

    const result = executeRules('x', [failA, failB], createContext('x'), 'parent');

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it('stops at first failure when bail is true', () => {
    const failA = createRule({
      name: 'failA',
      validate: () => Err({message: 'error A'}),
    });
    const failB = createRule({
      name: 'failB',
      validate: () => Err({message: 'error B'}),
    });

    const result = executeRules('x', [failA, failB], createContext('x', true), 'parent');

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});
