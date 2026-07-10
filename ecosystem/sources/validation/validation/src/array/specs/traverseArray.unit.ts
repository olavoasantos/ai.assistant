import {describe, expect, it} from 'vitest';
import {traverseArray} from '../traverseArray';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

function makeContext(value: unknown, options = {}) {
  return {options, root: value, parent: undefined, path: [] as PropertyKey[], key: undefined};
}

describe('traverseArray', () => {
  it('validates each element and returns output array', () => {
    const numRule = createRule<unknown, number>({
      name: 'number',
      validate: (v) => (typeof v === 'number' ? Ok(v) : Err()),
    });
    const traverse = traverseArray(numRule);
    const value = [1, 2, 3];
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  it('returns issues with numeric index in path', () => {
    const numRule = createRule<unknown, number>({
      name: 'number',
      validate: () => Err(),
    });
    const traverse = traverseArray(numRule);
    const value = ['bad'];
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toContain(0);
    }
  });

  it('returns empty output for empty array', () => {
    const numRule = createRule<unknown, number>({
      name: 'number',
      validate: (v) => (typeof v === 'number' ? Ok(v) : Err()),
    });
    const traverse = traverseArray(numRule);
    const value: unknown[] = [];
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('honors bail mode and stops after first element failure', () => {
    const numRule = createRule<unknown, number>({
      name: 'number',
      validate: () => Err(),
    });
    const traverse = traverseArray(numRule);
    const value = ['a', 'b', 'c'];
    const context = {
      options: {bail: true},
      root: value,
      parent: undefined,
      path: [] as PropertyKey[],
      key: undefined,
    };
    const result = traverse(value, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
    }
  });
});
