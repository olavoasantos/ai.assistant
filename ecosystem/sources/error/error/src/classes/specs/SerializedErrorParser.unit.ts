import {describe, expect, it, vi} from 'vitest';
import {SerializedErrorParser} from '../SerializedErrorParser';
import {ApplicationError} from '../ApplicationError';
import {ErrorIssue} from '../ErrorIssue';
import {ApplicationErrorGuard} from '../../guards/ApplicationErrorGuard';

const TIMESTAMP = '2026-07-17T10:00:00.000Z';

describe('SerializedErrorParser', () => {
  it('reconstructs null-prototype records and explicit stacks', () => {
    const value = Object.assign(Object.create(null), {
      message: 'Remote',
      code: 409,
      severity: 'fatal',
      metadata: Object.assign(Object.create(null), {requestId: 'request:1'}),
      timestamp: TIMESTAMP,
      stack: 'remote stack',
    });
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);

    const error = parser.parse(value);

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toMatchObject({
      message: 'Remote',
      code: 409,
      severity: 'fatal',
      metadata: {requestId: 'request:1'},
      timestamp: TIMESTAMP,
      stack: 'remote stack',
    });
  });

  it('accepts equivalent ISO 8601 timestamp representations', () => {
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);

    const error = parser.parse({
      message: 'Remote',
      code: 500,
      severity: 'recoverable',
      metadata: {},
      timestamp: '2026-07-17T12:00:00+02:00',
    });

    expect(error.timestamp).toBe('2026-07-17T12:00:00+02:00');
    expect(Object.getOwnPropertyDescriptor(error, 'timestamp')).toMatchObject({
      configurable: false,
      writable: false,
    });
  });

  it('reconstructs issue causes and truncates nested error causes', () => {
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 1);

    const error = parser.parse({
      message: 'Outer',
      code: 500,
      severity: 'recoverable',
      metadata: {},
      timestamp: TIMESTAMP,
      issues: [{message: 'Issue', cause: {message: 'Leaf', stack: 'leaf stack'}}],
      cause: {
        message: 'Middle',
        code: 500,
        severity: 'recoverable',
        metadata: {},
        timestamp: TIMESTAMP,
        cause: {
          message: 'Inner',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: TIMESTAMP,
        },
      },
    });

    expect(error.issues[0].cause).toBeUndefined();
    expect(error.cause).toMatchObject({message: 'Middle', cause: undefined});
  });

  it('clones deeply nested metadata without recursive stack consumption', () => {
    const metadata: Record<string, unknown> = {};
    let current = metadata;

    for (let index = 0; index < 1_000; index += 1) {
      const child: Record<string, unknown> = {};
      current.child = child;
      current = child;
    }
    current.value = 'leaf';

    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);
    const error = parser.parse({
      message: 'Deep metadata',
      code: 500,
      severity: 'recoverable',
      metadata,
      timestamp: TIMESTAMP,
    });

    expect(error.metadata).not.toBe(metadata);
    expect((error.metadata.child as Record<string, unknown>).child).toBeDefined();
  });

  it('clones shared metadata aliases without retaining input references', () => {
    const shared = {id: 'request:1'};
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);

    const error = parser.parse({
      message: 'Aliases',
      code: 500,
      severity: 'recoverable',
      metadata: {first: shared, second: shared},
      timestamp: TIMESTAMP,
    });
    const first = error.metadata.first as Record<string, unknown>;
    const second = error.metadata.second as Record<string, unknown>;

    shared.id = 'changed';

    expect(first).toBe(second);
    expect(first).not.toBe(shared);
    expect(first.id).toBe('request:1');
  });

  it('copies prototype-named metadata keys without prototype pollution', () => {
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);
    const metadata = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;

    const error = parser.parse({
      message: 'Prototype key',
      code: 500,
      severity: 'recoverable',
      metadata,
      timestamp: TIMESTAMP,
    });

    expect(Object.getPrototypeOf(error.metadata)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(Object.getOwnPropertyDescriptor(error.metadata, '__proto__')?.value).toEqual({
      polluted: true,
    });
  });

  it('rejects malformed timestamps, cyclic metadata, and invalid depth', () => {
    const cyclicMetadata: Record<string, unknown> = {};
    cyclicMetadata.self = cyclicMetadata;

    expect(() =>
      new SerializedErrorParser(ApplicationError, ErrorIssue, 5).parse({
        message: 'Bad timestamp',
        code: 500,
        severity: 'recoverable',
        metadata: {},
        timestamp: 'not-a-timestamp',
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      new SerializedErrorParser(ApplicationError, ErrorIssue, 5).parse({
        message: 'Bad calendar date',
        code: 500,
        severity: 'recoverable',
        metadata: {},
        timestamp: '2026-02-29T10:00:00Z',
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      new SerializedErrorParser(ApplicationError, ErrorIssue, 5).parse({
        message: 'Cycle',
        code: 500,
        severity: 'recoverable',
        metadata: cyclicMetadata,
        timestamp: TIMESTAMP,
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      new SerializedErrorParser(ApplicationError, ErrorIssue, Number.POSITIVE_INFINITY).parse({}),
    ).toThrow(ApplicationError);
  });

  it('rejects accessors without evaluating them', () => {
    const readMessage = vi.fn(() => 'Accessor');
    const value: Record<string, unknown> = {
      code: 500,
      severity: 'recoverable',
      metadata: {},
      timestamp: TIMESTAMP,
    };
    Object.defineProperty(value, 'message', {enumerable: true, get: readMessage});
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);

    expect(() => parser.parse(value)).toThrow(ApplicationError);
    expect(readMessage).not.toHaveBeenCalled();
  });

  it('rejects custom prototypes with a safe branded error', () => {
    const value = Object.assign(Object.create({inherited: true}), {
      message: 'Custom prototype',
      code: 500,
      severity: 'recoverable',
      metadata: {},
      timestamp: TIMESTAMP,
    });
    const parser = new SerializedErrorParser(ApplicationError, ErrorIssue, 5);

    try {
      parser.parse(value);
      expect.unreachable('Expected parser to reject the custom prototype');
    } catch (error) {
      expect(ApplicationErrorGuard(error)).toBe(true);
      expect((error as ApplicationError).cause).toBeUndefined();
      expect((error as ApplicationError).metadata).toEqual({});
    }
  });
});
