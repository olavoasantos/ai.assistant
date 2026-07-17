import {describe, expect, it} from 'vitest';
import {ApplicationError} from '../ApplicationError';
import {ErrorIssue} from '../ErrorIssue';
import {APPLICATION_ERROR_IDENTIFIER} from '../../constants';

describe('ApplicationError', () => {
  describe('constructor', () => {
    it('should create an error from a string message', () => {
      const error = new ApplicationError('Something broke');

      expect(error.message).toBe('Something broke');
      expect(error.code).toBe(500);
      expect(error.severity).toBe('recoverable');
      expect(error.reference).toBeUndefined();
      expect(error.metadata).toEqual({});
      expect(error.cause).toBeUndefined();
      expect(error.hasIssues).toBe(false);
      expect(error.issues).toEqual([]);
    });

    it('should create an error from full options', () => {
      const error = new ApplicationError({
        message: 'Not found',
        code: 404,
        severity: 'fatal',
        reference: 'user:1234',
        metadata: {userId: '1234'},
        cause: new Error('original'),
      });

      expect(error.message).toBe('Not found');
      expect(error.code).toBe(404);
      expect(error.severity).toBe('fatal');
      expect(error.reference).toBe('user:1234');
      expect(error.metadata).toEqual({userId: '1234'});
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should default code to 500', () => {
      const error = new ApplicationError({message: 'test'});
      expect(error.code).toBe(500);
    });

    it('should default severity to recoverable', () => {
      const error = new ApplicationError({message: 'test'});
      expect(error.severity).toBe('recoverable');
    });

    it('should set an ISO timestamp', () => {
      const before = new Date().toISOString();
      const error = new ApplicationError('test');
      const after = new Date().toISOString();

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });

    it('should expose timestamp as runtime read-only', () => {
      const error = new ApplicationError('test');

      expect(() => {
        (error as {timestamp: string}).timestamp = '2026-07-17T10:00:00.000Z';
      }).toThrow(TypeError);
      expect(Object.getOwnPropertyDescriptor(error, 'timestamp')).toMatchObject({
        configurable: false,
        writable: false,
      });
    });

    it('should be an instance of Error', () => {
      const error = new ApplicationError('test');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have the symbol brand', () => {
      const error = new ApplicationError('test');
      expect(error[APPLICATION_ERROR_IDENTIFIER]).toBe(true);
    });
  });

  describe('add()', () => {
    it('should add a single error as an issue', () => {
      const error = new ApplicationError('parent');
      const child = new Error('child');

      error.add(child);

      expect(error.hasIssues).toBe(true);
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0].message).toBe('child');
      expect(error.issues[0].cause).toBe(child);
    });

    it('should accept ErrorIssue instances directly', () => {
      const error = new ApplicationError('parent');
      const issue = new ErrorIssue({message: 'validation', path: ['email']});

      error.add(issue);

      expect(error.issues[0]).toBe(issue);
    });

    it('should accept ApplicationError instances', () => {
      const parent = new ApplicationError('parent');
      const child = new ApplicationError({message: 'child', code: 400});

      parent.add(child);

      expect(parent.issues).toHaveLength(1);
      expect(parent.issues[0].message).toBe('child');
      expect(parent.issues[0].cause).toBe(child);
    });

    it('should return this for fluent chaining', () => {
      const error = new ApplicationError('test');
      const result = error.add(new Error('a'));

      expect(result).toBe(error);
    });

    it('should support chained add calls', () => {
      const error = new ApplicationError('test').add(new Error('a')).add(new Error('b'));

      expect(error.issues).toHaveLength(2);
    });
  });

  describe('addMany()', () => {
    it('should add multiple errors as issues', () => {
      const error = new ApplicationError('parent');

      error.addMany([new Error('one'), new Error('two'), new Error('three')]);

      expect(error.issues).toHaveLength(3);
      expect(error.issues[0].message).toBe('one');
      expect(error.issues[1].message).toBe('two');
      expect(error.issues[2].message).toBe('three');
    });

    it('should return this for fluent chaining', () => {
      const error = new ApplicationError('test');
      const result = error.addMany([new Error('a')]);

      expect(result).toBe(error);
    });
  });

  describe('set()', () => {
    it('should update severity', () => {
      const error = new ApplicationError('test');
      error.set('severity', 'fatal');

      expect(error.severity).toBe('fatal');
    });

    it('should update code', () => {
      const error = new ApplicationError('test');
      error.set('code', 404);

      expect(error.code).toBe(404);
    });

    it('should update reference', () => {
      const error = new ApplicationError('test');
      error.set('reference', 'op:5678');

      expect(error.reference).toBe('op:5678');
    });

    it('should replace metadata entirely', () => {
      const error = new ApplicationError({message: 'test', metadata: {a: 1, b: 2}});
      error.set('metadata', {c: 3});

      expect(error.metadata).toEqual({c: 3});
    });

    it('should return this for fluent chaining', () => {
      const error = new ApplicationError('test');
      const result = error.set('code', 400);

      expect(result).toBe(error);
    });
  });

  describe('setMany()', () => {
    it('should update severity', () => {
      const error = new ApplicationError('test');
      error.setMany({severity: 'fatal'});

      expect(error.severity).toBe('fatal');
    });

    it('should update code', () => {
      const error = new ApplicationError('test');
      error.setMany({code: 404});

      expect(error.code).toBe(404);
    });

    it('should update reference', () => {
      const error = new ApplicationError('test');
      error.setMany({reference: 'op:5678'});

      expect(error.reference).toBe('op:5678');
    });

    it('should merge metadata with existing values', () => {
      const error = new ApplicationError({message: 'test', metadata: {a: 1}});
      error.setMany({metadata: {b: 2}});

      expect(error.metadata).toEqual({a: 1, b: 2});
    });

    it('should override existing metadata keys on merge', () => {
      const error = new ApplicationError({message: 'test', metadata: {a: 1, b: 2}});
      error.setMany({metadata: {b: 99, c: 3}});

      expect(error.metadata).toEqual({a: 1, b: 99, c: 3});
    });

    it('should update multiple fields at once', () => {
      const error = new ApplicationError('test');
      error.setMany({severity: 'fatal', code: 503, reference: 'retry:3'});

      expect(error.severity).toBe('fatal');
      expect(error.code).toBe(503);
      expect(error.reference).toBe('retry:3');
    });

    it('should return this for fluent chaining', () => {
      const error = new ApplicationError('test');
      const result = error.setMany({code: 400});

      expect(result).toBe(error);
    });

    it('should not affect fields not included in the options', () => {
      const error = new ApplicationError({
        message: 'test',
        code: 400,
        severity: 'fatal',
        reference: 'ref',
        metadata: {a: 1},
      });

      error.setMany({code: 500});

      expect(error.severity).toBe('fatal');
      expect(error.reference).toBe('ref');
      expect(error.metadata).toEqual({a: 1});
    });
  });

  describe('removeAll()', () => {
    it('should remove all issues', () => {
      const error = new ApplicationError('test');
      error.addMany([new Error('a'), new Error('b')]);

      error.removeAll();

      expect(error.hasIssues).toBe(false);
      expect(error.issues).toHaveLength(0);
    });

    it('should return this for fluent chaining', () => {
      const error = new ApplicationError('test');
      const result = error.removeAll();

      expect(result).toBe(error);
    });
  });

  describe('toJSON', () => {
    it('should serialize basic fields', () => {
      const error = new ApplicationError({
        message: 'test error',
        code: 400,
        severity: 'recoverable',
      });
      const json = error.toJSON();

      expect(json.message).toBe('test error');
      expect(json.code).toBe(400);
      expect(json.severity).toBe('recoverable');
      expect(json.metadata).toEqual({});
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeUndefined();
    });

    it('should include reference when set', () => {
      const error = new ApplicationError({message: 'test', reference: 'op:123'});
      const json = error.toJSON();

      expect(json.reference).toBe('op:123');
    });

    it('should exclude stack by default', () => {
      const error = new ApplicationError('test');
      const json = error.toJSON();

      expect(json.stack).toBeUndefined();
    });

    it('should include stack when requested', () => {
      const error = new ApplicationError('test');
      const json = error.toJSON({includeStack: true});

      expect(json.stack).toBeDefined();
    });

    it('should serialize issues', () => {
      const error = new ApplicationError('parent');
      error.addMany([new Error('child-a'), new Error('child-b')]);
      const json = error.toJSON();

      expect(json.issues).toHaveLength(2);
      expect(json.issues?.[0].message).toBe('child-a');
      expect(json.issues?.[1].message).toBe('child-b');
    });

    it('should respect depth limit for issues', () => {
      const error = new ApplicationError('parent');
      error.add(new Error('child'));
      const json = error.toJSON({depth: 0});

      expect(json.issues).toBeUndefined();
    });

    it('should serialize cause when present', () => {
      const cause = new Error('root cause');
      const error = new ApplicationError({message: 'wrapper', cause});
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.message).toBe('root cause');
    });

    it('should serialize ApplicationError cause with full structure', () => {
      const cause = new ApplicationError({message: 'inner', code: 503, severity: 'fatal'});
      const error = new ApplicationError({message: 'outer', cause});
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.message).toBe('inner');
      expect(json.cause?.code).toBe(503);
      expect(json.cause?.severity).toBe('fatal');
    });

    it('should limit nested serialization depth', () => {
      const deep = new ApplicationError({message: 'level-3', cause: new Error('level-4')});
      const mid = new ApplicationError({message: 'level-2', cause: deep});
      const top = new ApplicationError({message: 'level-1', cause: mid});

      const json = top.toJSON({depth: 2});

      expect(json.cause?.message).toBe('level-2');
      expect(json.cause?.cause?.message).toBe('level-3');
      expect(json.cause?.cause?.cause).toBeUndefined();
    });
  });

  describe('fromJSON', () => {
    it('should round-trip every serialized field into fresh structures', () => {
      const cause = new ApplicationError({
        message: 'inner',
        code: 503,
        severity: 'fatal',
        metadata: {region: 'local'},
      });
      const original = new ApplicationError({
        message: 'outer',
        code: 409,
        severity: 'recoverable',
        reference: 'operation:1',
        metadata: {request: {id: 'request:1', tags: ['rpc']}},
        cause,
      });
      original.add(new ErrorIssue({message: 'issue', path: ['input', 0]}));
      const serialized = original.toJSON({includeStack: true});

      const reconstructed = ApplicationError.fromJSON(serialized);

      expect(reconstructed).not.toBe(original);
      expect(reconstructed).toBeInstanceOf(ApplicationError);
      expect(reconstructed).toMatchObject({
        message: 'outer',
        code: 409,
        severity: 'recoverable',
        reference: 'operation:1',
        metadata: {request: {id: 'request:1', tags: ['rpc']}},
        timestamp: original.timestamp,
        stack: serialized.stack,
      });
      expect(reconstructed.metadata).not.toBe(original.metadata);
      expect(reconstructed.issues[0]).toMatchObject({message: 'issue', path: ['input', 0]});
      expect(reconstructed.cause).toMatchObject({
        message: 'inner',
        code: 503,
        severity: 'fatal',
        metadata: {region: 'local'},
        timestamp: cause.timestamp,
      });
      expect(reconstructed[APPLICATION_ERROR_IDENTIFIER]).toBe(true);
    });

    it('should not synthesize a stack absent from serialized input', () => {
      const reconstructed = ApplicationError.fromJSON({
        message: 'remote',
        code: 500,
        severity: 'recoverable',
        metadata: {},
        timestamp: '2026-07-17T10:00:00.000Z',
      });

      expect(reconstructed.stack).toBeUndefined();
    });

    it('should reject malformed input without retaining it', () => {
      const malformed = {message: 'remote'};

      try {
        ApplicationError.fromJSON(malformed);
        expect.unreachable('Expected malformed input to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).cause).toBeUndefined();
        expect((error as ApplicationError).metadata).toEqual({});
      }
    });
  });

  describe('from', () => {
    it('should normalize an ApplicationError into a new instance', () => {
      const original = new ApplicationError({
        message: 'original',
        code: 400,
        severity: 'fatal',
        reference: 'ref',
        metadata: {key: 'val'},
      });
      original.add(new Error('issue'));

      const normalized = ApplicationError.from(original);

      expect(normalized).not.toBe(original);
      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('original');
      expect(normalized.code).toBe(400);
      expect(normalized.severity).toBe('fatal');
      expect(normalized.reference).toBe('ref');
      expect(normalized.metadata).toEqual({key: 'val'});
      expect(normalized.cause).toBe(original);
      expect(normalized.issues).toHaveLength(1);
    });

    it('should normalize a plain Error', () => {
      const error = new Error('plain error');
      const normalized = ApplicationError.from(error);

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('plain error');
      expect(normalized.code).toBe(500);
      expect(normalized.severity).toBe('recoverable');
      expect(normalized.cause).toBe(error);
    });

    it('should normalize a string', () => {
      const normalized = ApplicationError.from('string error');

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('string error');
      expect(normalized.code).toBe(500);
    });

    it('should normalize an object with a message property', () => {
      const obj = {message: 'object error', extra: true};
      const normalized = ApplicationError.from(obj);

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('object error');
      expect(normalized.cause).toBe(obj);
    });

    it('should normalize null', () => {
      const normalized = ApplicationError.from(null);

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('An unknown error occurred');
      expect(normalized.metadata).toEqual({value: null});
    });

    it('should normalize undefined', () => {
      const normalized = ApplicationError.from(undefined);

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('An unknown error occurred');
      expect(normalized.metadata).toEqual({value: undefined});
    });

    it('should normalize a number', () => {
      const normalized = ApplicationError.from(42);

      expect(normalized).toBeInstanceOf(ApplicationError);
      expect(normalized.message).toBe('An unknown error occurred');
      expect(normalized.metadata).toEqual({value: 42});
    });

    it('should create a fresh metadata copy from ApplicationError', () => {
      const original = new ApplicationError({message: 'test', metadata: {key: 'val'}});
      const normalized = ApplicationError.from(original);

      normalized.set('metadata', {key: 'changed'});

      expect(original.metadata.key).toBe('val');
    });
  });
});
