import {describe, expect, it} from 'vitest';
import {ErrorGuard} from '../ErrorGuard';
import {ApplicationError} from '../../classes/ApplicationError';

describe('ErrorGuard', () => {
  it('should return true for an Error instance', () => {
    expect(ErrorGuard(new Error('test'))).toBe(true);
  });

  it('should return true for a TypeError', () => {
    expect(ErrorGuard(new TypeError('test'))).toBe(true);
  });

  it('should return true for an ApplicationError', () => {
    expect(ErrorGuard(new ApplicationError('test'))).toBe(true);
  });

  it('should return false for a plain object', () => {
    expect(ErrorGuard({message: 'test'})).toBe(false);
  });

  it('should return false for a string', () => {
    expect(ErrorGuard('error')).toBe(false);
  });

  it('should return false for null', () => {
    expect(ErrorGuard(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(ErrorGuard(undefined)).toBe(false);
  });
});
