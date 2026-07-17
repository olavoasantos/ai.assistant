import {describe, expect, it, vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/error';

/**
 * Factories used by error implementations to run the shared compliance suite.
 */
export interface ErrorComplianceTestSuite {
  /** Creates an application error from contract construction options. */
  ApplicationError: (
    options: Contract.ErrorOptions,
  ) => Contract.ApplicationError | Promise<Contract.ApplicationError>;

  /** Creates an error issue from contract construction options. */
  ErrorIssue: (
    options: Contract.ErrorIssueOptions,
  ) => Contract.ErrorIssue | Promise<Contract.ErrorIssue>;

  /** Normalizes any thrown value into an application error. */
  normalizeError?: (
    value: unknown,
  ) => Contract.ApplicationError | Promise<Contract.ApplicationError>;

  /** Normalizes an error-like issue value into an error issue. */
  normalizeIssue?: (
    value: Error | Contract.ErrorIssue,
  ) => Contract.ErrorIssue | Promise<Contract.ErrorIssue>;

  /** Reconstructs an application error from untrusted serialized data. */
  deserializeError: Contract.ErrorDeserializer;
}

/**
 * Registers the shared behavioural tests every error implementation must satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter for
 * structured errors: defaults, mutation semantics, aggregation, serialization,
 * and optional normalization and deserialization behaviour.
 */
export function runErrorComplianceTests(factories: ErrorComplianceTestSuite): void {
  describe('error compliance', () => {
    describe('ApplicationError', () => {
      it('uses contract defaults when only a message is provided', async () => {
        const error = await factories.ApplicationError({message: 'Something broke'});

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Something broke');
        expect(error.code).toBe(500);
        expect(error.severity).toBe('recoverable');
        expect(error.reference).toBeUndefined();
        expect(error.metadata).toEqual({});
        expect(error.issues).toEqual([]);
        expect(error.hasIssues).toBe(false);
        expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      it('preserves explicitly provided construction options', async () => {
        const cause = new Error('root cause');
        const error = await factories.ApplicationError({
          message: 'Not found',
          code: 404,
          severity: 'fatal',
          reference: 'user:1234',
          metadata: {userId: '1234'},
          timestamp: '2026-07-17T10:00:00.000Z',
          cause,
        });

        expect(error.message).toBe('Not found');
        expect(error.code).toBe(404);
        expect(error.severity).toBe('fatal');
        expect(error.reference).toBe('user:1234');
        expect(error.metadata).toEqual({userId: '1234'});
        expect(error.timestamp).toBe('2026-07-17T10:00:00.000Z');
        expect(
          Reflect.set(
            error as unknown as Record<string, unknown>,
            'timestamp',
            '2026-07-17T11:00:00.000Z',
          ),
        ).toBe(false);
        expect(error.cause).toBe(cause);
      });

      it('aggregates issues through add and addMany', async () => {
        const error = await factories.ApplicationError({message: 'Batch failed'});
        const first = new Error('first');
        const second = await factories.ErrorIssue({message: 'second', path: ['items', 1]});

        expect(error.add(first)).toBe(error);
        expect(error.addMany([second])).toBe(error);

        expect(error.hasIssues).toBe(true);
        expect(error.issues).toHaveLength(2);
        expect(error.issues[0].message).toBe('first');
        expect(error.issues[0].cause).toBe(first);
        expect(error.issues[1]).toBe(second);
      });

      it('updates mutable fields with replace and merge metadata semantics', async () => {
        const error = await factories.ApplicationError({message: 'Mutable', metadata: {a: 1}});

        expect(error.set('code', 422)).toBe(error);
        expect(error.set('severity', 'fatal')).toBe(error);
        expect(error.set('reference', 'operation:1')).toBe(error);
        expect(error.set('metadata', {b: 2})).toBe(error);

        expect(error.code).toBe(422);
        expect(error.severity).toBe('fatal');
        expect(error.reference).toBe('operation:1');
        expect(error.metadata).toEqual({b: 2});

        expect(error.setMany({code: 409, metadata: {c: 3}})).toBe(error);
        expect(error.code).toBe(409);
        expect(error.metadata).toEqual({b: 2, c: 3});
      });

      it('removes all aggregated issues', async () => {
        const error = await factories.ApplicationError({message: 'Batch failed'});

        error.addMany([new Error('first'), new Error('second')]);
        expect(error.hasIssues).toBe(true);

        expect(error.removeAll()).toBe(error);
        expect(error.hasIssues).toBe(false);
        expect(error.issues).toEqual([]);
      });

      it('serializes to plain JSON while omitting absent optional fields', async () => {
        const error = await factories.ApplicationError({message: 'Serializable', code: 400});
        const json = error.toJSON();

        expect(json.message).toBe('Serializable');
        expect(json.code).toBe(400);
        expect(json.severity).toBe('recoverable');
        expect(json.metadata).toEqual({});
        expect(json.timestamp).toBe(error.timestamp);
        expect(json.reference).toBeUndefined();
        expect(json.issues).toBeUndefined();
        expect(json.cause).toBeUndefined();
        expect(json.stack).toBeUndefined();
      });

      it('honours stack and depth serialization options', async () => {
        const cause = await factories.ApplicationError({message: 'Inner'});
        const error = await factories.ApplicationError({message: 'Outer', cause});
        error.add(new Error('issue'));

        const withStack = error.toJSON({includeStack: true});
        const withoutDepth = error.toJSON({depth: 0});

        expect(withStack.stack).toBeDefined();
        expect(withStack.cause?.message).toBe('Inner');
        expect(withStack.issues?.[0].message).toBe('issue');
        expect(withoutDepth.cause).toBeUndefined();
        expect(withoutDepth.issues).toBeUndefined();
      });
    });

    const deserializeError = factories.deserializeError;

    describe('ApplicationError deserialization', () => {
      it('reconstructs every serialized field with structured identity', () => {
        const serialized: Contract.SerializedError = {
          message: 'Remote failure',
          code: 409,
          severity: 'fatal',
          reference: 'operation:42',
          metadata: {request: {id: 'request:1', tags: ['rpc']}},
          timestamp: '2026-07-17T10:00:00.000Z',
          issues: [
            {
              message: 'Invalid argument',
              path: ['input', 0],
              cause: {message: 'Expected a string', stack: 'remote issue stack'},
            },
          ],
          cause: {
            message: 'Storage conflict',
            code: 503,
            severity: 'recoverable',
            metadata: {region: 'local'},
            timestamp: '2026-07-17T09:59:59.000Z',
          },
        };

        const error = deserializeError(serialized);
        const cause = error.cause as Contract.ApplicationError;

        expect(error.message).toBe('Remote failure');
        expect(error.code).toBe(409);
        expect(error.severity).toBe('fatal');
        expect(error.reference).toBe('operation:42');
        expect(error.metadata).toEqual({request: {id: 'request:1', tags: ['rpc']}});
        expect(error.timestamp).toBe('2026-07-17T10:00:00.000Z');
        expect(error.issues).toHaveLength(1);
        expect(error.issues[0]).toMatchObject({
          message: 'Invalid argument',
          path: ['input', 0],
        });
        expect((error.issues[0].cause as Error).message).toBe('Expected a string');
        expect((error.issues[0].cause as Error).stack).toBe('remote issue stack');
        expect(cause).toMatchObject({
          message: 'Storage conflict',
          code: 503,
          severity: 'recoverable',
          metadata: {region: 'local'},
          timestamp: '2026-07-17T09:59:59.000Z',
        });
        expect(
          (error as unknown as Record<symbol, unknown>)[
            Symbol.for('ai.assistant:ApplicationError')
          ],
        ).toBe(true);
      });

      it('retains stacks only when they were explicitly serialized', () => {
        const withoutStack = deserializeError({
          message: 'No stack',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
        });
        const withStack = deserializeError({
          message: 'With stack',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
          stack: 'remote application stack',
        });

        expect(withoutStack.stack).toBeUndefined();
        expect(withStack.stack).toBe('remote application stack');
      });

      it('truncates issues and causes at the configured depth', () => {
        const serialized: Contract.SerializedError = {
          message: 'Outer',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
          issues: [{message: 'Issue', cause: {message: 'Issue cause'}}],
          cause: {
            message: 'Middle',
            code: 500,
            severity: 'recoverable',
            metadata: {},
            timestamp: '2026-07-17T09:59:59.000Z',
            cause: {
              message: 'Inner',
              code: 500,
              severity: 'recoverable',
              metadata: {},
              timestamp: '2026-07-17T09:59:58.000Z',
            },
          },
        };

        const error = deserializeError(serialized, {depth: 1});
        const cause = error.cause as Contract.ApplicationError;

        expect(error.issues).toHaveLength(1);
        expect(error.issues[0].cause).toBeUndefined();
        expect(cause.message).toBe('Middle');
        expect(cause.cause).toBeUndefined();
      });

      it('omits values beyond the configured depth without inspecting them', () => {
        const readCause = vi.fn(() => ({message: 'unreachable'}));
        const serialized: Record<string, unknown> = {
          message: 'Truncated',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
          issues: 42,
        };
        Object.defineProperty(serialized, 'cause', {enumerable: true, get: readCause});

        const error = deserializeError(serialized, {depth: 0});

        expect(error.issues).toEqual([]);
        expect(error.cause).toBeUndefined();
        expect(readCause).not.toHaveBeenCalled();
      });

      it('does not retain mutable metadata or path references', () => {
        const tags = ['rpc'];
        const request = {id: 'request:1', tags};
        const metadata = {request};
        const path: Array<string | number> = ['input', 0];
        const serialized = {
          message: 'Detached',
          code: 400,
          severity: 'recoverable',
          metadata,
          timestamp: '2026-07-17T10:00:00.000Z',
          issues: [{message: 'Issue', path}],
        };

        const error = deserializeError(serialized);

        request.id = 'changed';
        tags.push('mutated');
        path[0] = 'changed';

        expect(error.metadata).toEqual({request: {id: 'request:1', tags: ['rpc']}});
        expect(error.issues[0].path).toEqual(['input', 0]);
      });

      it('rejects malformed and cyclic serialized values safely', async () => {
        const cyclic: Record<string, unknown> = {
          message: 'Cyclic',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
        };
        cyclic.cause = cyclic;

        await expect(
          Promise.resolve().then(() =>
            deserializeError({
              message: 'Wrong code',
              code: '500',
              severity: 'recoverable',
              metadata: {},
              timestamp: '2026-07-17T10:00:00.000Z',
            }),
          ),
        ).rejects.toMatchObject({
          [Symbol.for('ai.assistant:ApplicationError')]: true,
        });
        await expect(
          Promise.resolve().then(() =>
            deserializeError({
              message: 'Impossible date',
              code: 500,
              severity: 'recoverable',
              metadata: {},
              timestamp: '2026-02-29T10:00:00Z',
            }),
          ),
        ).rejects.toMatchObject({
          [Symbol.for('ai.assistant:ApplicationError')]: true,
        });
        await expect(Promise.resolve().then(() => deserializeError(cyclic))).rejects.toMatchObject({
          [Symbol.for('ai.assistant:ApplicationError')]: true,
        });
        await expect(
          Promise.resolve().then(() => deserializeError(cyclic, {depth: Number.POSITIVE_INFINITY})),
        ).rejects.toMatchObject({
          [Symbol.for('ai.assistant:ApplicationError')]: true,
        });
      });

      it('rejects custom prototypes and accessors without invoking them', async () => {
        const readMessage = vi.fn(() => 'Accessor');
        const accessorValue: Record<string, unknown> = {
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
        };
        Object.defineProperty(accessorValue, 'message', {
          enumerable: true,
          get: readMessage,
        });
        const customPrototypeValue = Object.assign(Object.create({inherited: true}), {
          message: 'Custom prototype',
          code: 500,
          severity: 'recoverable',
          metadata: {},
          timestamp: '2026-07-17T10:00:00.000Z',
        });

        await expect(
          Promise.resolve().then(() => deserializeError(accessorValue)),
        ).rejects.toBeDefined();
        await expect(
          Promise.resolve().then(() => deserializeError(customPrototypeValue)),
        ).rejects.toBeDefined();
        expect(readMessage).not.toHaveBeenCalled();
      });
    });

    describe('ErrorIssue', () => {
      it('preserves construction options', async () => {
        const cause = new Error('root cause');
        const issue = await factories.ErrorIssue({
          message: 'Invalid email',
          path: ['user', 'email'],
          cause,
        });

        expect(issue.message).toBe('Invalid email');
        expect(issue.path).toEqual(['user', 'email']);
        expect(issue.cause).toBe(cause);
      });

      it('serializes minimal and populated issues', async () => {
        const minimal = await factories.ErrorIssue({message: 'Minimal'});
        const populated = await factories.ErrorIssue({
          message: 'Populated',
          path: ['config'],
          cause: new Error('root cause'),
        });

        expect(minimal.toJSON()).toEqual({message: 'Minimal'});
        expect(populated.toJSON()).toMatchObject({
          message: 'Populated',
          path: ['config'],
          cause: {message: 'root cause'},
        });
        expect(populated.toJSON({depth: 0}).cause).toBeUndefined();
      });
    });

    const normalizeError = factories.normalizeError;

    if (normalizeError !== undefined) {
      describe('ApplicationError normalization', () => {
        it('always returns a new application error while preserving the original cause', async () => {
          const original = await factories.ApplicationError({
            message: 'Original',
            code: 400,
            severity: 'fatal',
            reference: 'original:1',
            metadata: {original: true},
          });
          original.add(new Error('child'));

          const normalized = await normalizeError(original);

          expect(normalized).not.toBe(original);
          expect(normalized.message).toBe('Original');
          expect(normalized.code).toBe(400);
          expect(normalized.severity).toBe('fatal');
          expect(normalized.reference).toBe('original:1');
          expect(normalized.metadata).toEqual({original: true});
          expect(normalized.cause).toBe(original);
          expect(normalized.issues).toHaveLength(1);

          normalized.metadata.original = false;
          expect(original.metadata.original).toBe(true);
        });

        it('accepts arbitrary thrown values without throwing', async () => {
          await expect(normalizeError(new Error('plain'))).resolves.toMatchObject({
            message: 'plain',
            code: 500,
            severity: 'recoverable',
          });
          await expect(normalizeError('string failure')).resolves.toMatchObject({
            message: 'string failure',
            cause: 'string failure',
          });
          await expect(normalizeError({message: 'object failure'})).resolves.toMatchObject({
            message: 'object failure',
          });
          await expect(normalizeError(null)).resolves.toMatchObject({
            message: 'An unknown error occurred',
            cause: null,
          });
          await expect(normalizeError(undefined)).resolves.toMatchObject({
            message: 'An unknown error occurred',
            cause: undefined,
          });
          await expect(normalizeError(42)).resolves.toMatchObject({
            message: 'An unknown error occurred',
            cause: 42,
          });
        });
      });
    }

    const normalizeIssue = factories.normalizeIssue;

    if (normalizeIssue !== undefined) {
      describe('ErrorIssue normalization', () => {
        it('is idempotent for existing issues', async () => {
          const issue = await factories.ErrorIssue({message: 'Existing'});

          await expect(normalizeIssue(issue)).resolves.toBe(issue);
        });

        it('creates issues from native errors', async () => {
          const cause = new Error('Native');
          const issue = await normalizeIssue(cause);

          expect(issue.message).toBe('Native');
          expect(issue.cause).toBe(cause);
        });
      });
    }
  });
}
