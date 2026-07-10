import {describe, expect, it} from 'vitest';
import {ErrorIssue} from '../ErrorIssue';
import {ERROR_ISSUE_IDENTIFIER} from '../../constants';

describe('ErrorIssue', () => {
  describe('constructor', () => {
    it('should create an issue with a message', () => {
      const issue = new ErrorIssue({message: 'Something went wrong'});

      expect(issue.message).toBe('Something went wrong');
      expect(issue.path).toBeUndefined();
      expect(issue.cause).toBeUndefined();
    });

    it('should create an issue with message and path', () => {
      const issue = new ErrorIssue({message: 'Invalid email', path: ['user', 'email']});

      expect(issue.message).toBe('Invalid email');
      expect(issue.path).toEqual(['user', 'email']);
    });

    it('should create an issue with message, path, and cause', () => {
      const originalError = new Error('original');
      const issue = new ErrorIssue({
        message: 'Validation failed',
        path: ['config', 'port'],
        cause: originalError,
      });

      expect(issue.message).toBe('Validation failed');
      expect(issue.path).toEqual(['config', 'port']);
      expect(issue.cause).toBe(originalError);
    });

    it('should have the symbol brand', () => {
      const issue = new ErrorIssue({message: 'test'});

      expect(issue[ERROR_ISSUE_IDENTIFIER]).toBe(true);
    });
  });

  describe('from', () => {
    it('should return an ErrorIssue as-is', () => {
      const original = new ErrorIssue({message: 'existing issue', path: ['a']});
      const result = ErrorIssue.from(original);

      expect(result).toBe(original);
    });

    it('should normalize a plain Error into an ErrorIssue', () => {
      const error = new Error('plain error');
      const result = ErrorIssue.from(error);

      expect(result).toBeInstanceOf(ErrorIssue);
      expect(result.message).toBe('plain error');
      expect(result.cause).toBe(error);
      expect(result.path).toBeUndefined();
    });

    it('should normalize a TypeError into an ErrorIssue', () => {
      const error = new TypeError('type mismatch');
      const result = ErrorIssue.from(error);

      expect(result).toBeInstanceOf(ErrorIssue);
      expect(result.message).toBe('type mismatch');
      expect(result.cause).toBe(error);
    });
  });

  describe('toJSON', () => {
    it('should serialize a minimal issue', () => {
      const issue = new ErrorIssue({message: 'bad value'});
      const json = issue.toJSON();

      expect(json).toEqual({message: 'bad value'});
    });

    it('should include path when present', () => {
      const issue = new ErrorIssue({message: 'invalid', path: ['a', 'b']});
      const json = issue.toJSON();

      expect(json).toEqual({message: 'invalid', path: ['a', 'b']});
    });

    it('should serialize an Error cause', () => {
      const cause = new Error('root cause');
      const issue = new ErrorIssue({message: 'wrapper', cause});
      const json = issue.toJSON();

      expect(json.message).toBe('wrapper');
      expect(json.cause).toBeDefined();
      expect(json.cause?.message).toBe('root cause');
    });

    it('should include stack in cause when includeStack is true', () => {
      const cause = new Error('with stack');
      const issue = new ErrorIssue({message: 'wrapper', cause});
      const json = issue.toJSON({includeStack: true});

      expect(json.cause).toBeDefined();
      expect((json.cause as {stack?: string}).stack).toBeDefined();
    });

    it('should omit cause when depth is 0', () => {
      const cause = new Error('deep');
      const issue = new ErrorIssue({message: 'shallow', cause});
      const json = issue.toJSON({depth: 0});

      expect(json.cause).toBeUndefined();
    });

    it('should omit non-error causes from serialization', () => {
      const issue = new ErrorIssue({message: 'test', cause: 'string cause'});
      const json = issue.toJSON();

      expect(json.cause).toBeUndefined();
    });
  });
});
