import {describe, expect, it} from 'vitest';
import {traverseObject} from '../traverseObject';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

function makeContext(value: unknown, options = {}) {
  return {options, root: value, parent: undefined, path: [] as PropertyKey[], key: undefined};
}

describe('traverseObject', () => {
  it('validates shape properties and returns output', () => {
    const nameRule = createRule<unknown, string>({
      name: 'string',
      validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
    });
    const traverse = traverseObject({name: nameRule});
    const value = {name: 'Alice'};
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({name: 'Alice'});
    }
  });

  it('returns issues with property key in path', () => {
    const nameRule = createRule<unknown, string>({
      name: 'string',
      validate: () => Err(),
    });
    const traverse = traverseObject({name: nameRule});
    const value = {name: 42};
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toContain('name');
    }
  });

  it('strips extra properties by default', () => {
    const nameRule = createRule<unknown, string>({
      name: 'string',
      validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
    });
    const traverse = traverseObject({name: nameRule});
    const value = {name: 'Alice', age: 30};
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({name: 'Alice'});
      expect((result.value as any).age).toBeUndefined();
    }
  });

  it('rejects extra properties when extraProperties is "reject"', () => {
    const nameRule = createRule<unknown, string>({
      name: 'string',
      validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
    });
    const traverse = traverseObject({name: nameRule}, {extraProperties: 'reject'});
    const value = {name: 'Alice', age: 30};
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.message === 'validation.object.extraProperty')).toBe(true);
    }
  });

  it('passes through extra properties when extraProperties is "passthrough"', () => {
    const nameRule = createRule<unknown, string>({
      name: 'string',
      validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
    });
    const traverse = traverseObject({name: nameRule}, {extraProperties: 'passthrough'});
    const value = {name: 'Alice', age: 30};
    const result = traverse(value, makeContext(value));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({name: 'Alice', age: 30});
    }
  });

  it('honors bail mode and stops after first property failure', () => {
    const failRule = createRule<unknown, string>({
      name: 'string',
      validate: () => Err(),
    });
    const traverse = traverseObject({a: failRule, b: failRule});
    const value = {a: 1, b: 2};
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
