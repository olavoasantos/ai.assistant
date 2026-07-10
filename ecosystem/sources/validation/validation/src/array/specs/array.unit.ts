import {describe, expect, it} from 'vitest';
import {array} from '..';
import {string} from '../../string';
import {number} from '../../number';
import {createRule} from '../../custom/rule';
import {Ok} from '../../utilities/Ok';
import {Err} from '../../utilities/Err';

describe('array', () => {
  it('passes valid arrays with matching element types', () => {
    const schema = array(string());
    const result = schema.validate(['hello', 'world']);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(['hello', 'world']);
  });

  it('passes valid arrays of numbers', () => {
    const schema = array(number());
    const result = schema.validate([1, 2, 3]);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual([1, 2, 3]);
  });

  it('fails null', () => {
    const schema = array(string());
    const result = schema.validate(null);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.array');
  });

  it('fails objects', () => {
    const schema = array(string());
    const result = schema.validate({});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.array');
  });

  it('fails strings', () => {
    const schema = array(string());
    const result = schema.validate('hello');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.array');
  });

  it('passes empty arrays', () => {
    const schema = array(string());
    const result = schema.validate([]);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual([]);
  });

  it('element issues have numeric path segments', () => {
    const schema = array(string());
    const result = schema.validate(['hello', 42, 'world', true]);

    expect(result.ok).toBe(false);
    expect(result.issues!.length).toBe(2);
    expect(result.issues![0]!.path).toEqual([1]);
    expect(result.issues![1]!.path).toEqual([3]);
  });

  it('supports container-level rules via options.rules', () => {
    const nonEmpty = createRule<unknown[], unknown[]>({
      name: 'nonEmpty',
      validate(value) {
        return value.length > 0 ? Ok(value) : Err();
      },
    });

    const schema = array(string(), {rules: [nonEmpty]});
    const result = schema.validate([]);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.array.nonEmpty');
  });

  it('passes container-level rules when satisfied', () => {
    const nonEmpty = createRule<unknown[], unknown[]>({
      name: 'nonEmpty',
      validate(value) {
        return value.length > 0 ? Ok(value) : Err();
      },
    });

    const schema = array(string(), {rules: [nonEmpty]});
    const result = schema.validate(['hello']);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(['hello']);
  });
});
