import {describe, expect, it} from 'vitest';
import {ErrorIssueGuard} from '../ErrorIssueGuard';
import {ErrorIssue} from '../../classes/ErrorIssue';

describe('ErrorIssueGuard', () => {
  it('should return true for an ErrorIssue instance', () => {
    const issue = new ErrorIssue({message: 'test'});
    expect(ErrorIssueGuard(issue)).toBe(true);
  });

  it('should return true for an ErrorIssue with path and cause', () => {
    const issue = new ErrorIssue({
      message: 'invalid',
      path: ['user', 'email'],
      cause: new Error('original'),
    });
    expect(ErrorIssueGuard(issue)).toBe(true);
  });

  it('should return true for an ErrorIssue created via from()', () => {
    const issue = ErrorIssue.from(new Error('test'));
    expect(ErrorIssueGuard(issue)).toBe(true);
  });

  it('should return false for a plain Error', () => {
    expect(ErrorIssueGuard(new Error('test'))).toBe(false);
  });

  it('should return false for a plain object', () => {
    expect(ErrorIssueGuard({message: 'test'})).toBe(false);
  });

  it('should return false for null', () => {
    expect(ErrorIssueGuard(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(ErrorIssueGuard(undefined)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(ErrorIssueGuard('test')).toBe(false);
    expect(ErrorIssueGuard(42)).toBe(false);
  });
});
