import {describe, expect, it} from 'vitest';
import {throwValidationError} from '../throwValidationError';

describe('throwValidationError', () => {
  const result = {
    ok: false as const,
    value: undefined,
    issues: [{message: 'bad', rule: 'test'}],
  };

  it('throws an error with message "Validation failed"', () => {
    expect(() => throwValidationError(result)).toThrow('Validation failed');
  });

  it('thrown error has code 400', () => {
    try {
      throwValidationError(result);
    } catch (error: any) {
      expect(error.code).toBe(400);
    }
  });

  it('thrown error has issues matching the failure result issues by message', () => {
    try {
      throwValidationError(result);
    } catch (error: any) {
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0].message).toBe('bad');
    }
  });

  it('handles path segments that are PathSegment objects', () => {
    const resultWithPath = {
      ok: false as const,
      value: undefined,
      issues: [{message: 'bad', rule: 'test', path: [{key: 'name'}, 'age']}],
    };

    try {
      throwValidationError(resultWithPath);
    } catch (error: any) {
      expect(error.issues[0].path).toEqual(['name', 'age']);
    }
  });
});
