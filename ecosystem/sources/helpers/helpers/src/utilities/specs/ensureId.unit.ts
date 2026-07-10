import {describe, it, expect} from 'vitest';
import {ensureId} from '../ensureId';
import {generateId} from '../generateId';

describe('ensureId', () => {
  it('should parse a valid ID and return prefix and id', () => {
    const result = ensureId('ai.assistant:a8b3c9d2');

    expect(result).toEqual({prefix: 'ai.assistant', id: 'a8b3c9d2'});
  });

  it('should return the correct prefix', () => {
    const result = ensureId('app:12345');

    expect(result.prefix).toBe('app');
  });

  it('should return the correct id', () => {
    const result = ensureId('app:12345');

    expect(result.id).toBe('12345');
  });

  it('should handle id containing colons by splitting only on the first colon', () => {
    const result = ensureId('ai.assistant:some:complex:id');

    expect(result.prefix).toBe('ai.assistant');
    expect(result.id).toBe('some:complex:id');
  });

  it('should throw TypeError for empty string', () => {
    expect(() => ensureId('')).toThrow(TypeError);
  });

  it('should throw TypeError for string with no colon', () => {
    expect(() => ensureId('nocolonhere')).toThrow(TypeError);
  });

  it('should throw TypeError for string with empty prefix', () => {
    expect(() => ensureId(':abc')).toThrow(TypeError);
  });

  it('should throw TypeError for string with empty id', () => {
    expect(() => ensureId('prefix:')).toThrow(TypeError);
  });

  it('should round-trip with generateId', () => {
    const result = ensureId(generateId('test'));

    expect(result.prefix).toBe('test');
    expect(result.id).toHaveLength(8);
    expect(result.id).toMatch(/^[a-z0-9]+$/);
  });
});
