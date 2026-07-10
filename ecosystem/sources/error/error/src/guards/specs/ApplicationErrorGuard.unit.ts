import {describe, expect, it} from 'vitest';
import {ApplicationErrorGuard} from '../ApplicationErrorGuard';
import {ApplicationError} from '../../classes/ApplicationError';

describe('ApplicationErrorGuard', () => {
  it('should return true for an ApplicationError instance', () => {
    const error = new ApplicationError('test');
    expect(ApplicationErrorGuard(error)).toBe(true);
  });

  it('should return true for an ApplicationError created via from()', () => {
    const error = ApplicationError.from(new Error('test'));
    expect(ApplicationErrorGuard(error)).toBe(true);
  });

  it('should return true for an ApplicationError with full options', () => {
    const error = new ApplicationError({
      message: 'test',
      code: 400,
      severity: 'fatal',
      reference: 'ref',
      metadata: {key: 'val'},
    });
    expect(ApplicationErrorGuard(error)).toBe(true);
  });

  it('should return false for a plain Error', () => {
    expect(ApplicationErrorGuard(new Error('test'))).toBe(false);
  });

  it('should return false for a TypeError', () => {
    expect(ApplicationErrorGuard(new TypeError('test'))).toBe(false);
  });

  it('should return false for a plain object', () => {
    expect(ApplicationErrorGuard({message: 'test', code: 500})).toBe(false);
  });

  it('should return false for a string', () => {
    expect(ApplicationErrorGuard('error')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(ApplicationErrorGuard(42)).toBe(false);
  });

  it('should return false for null', () => {
    expect(ApplicationErrorGuard(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(ApplicationErrorGuard(undefined)).toBe(false);
  });
});
