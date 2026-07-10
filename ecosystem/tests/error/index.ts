import {describe, expect, it} from 'vitest';
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
}

/**
 * Registers the shared behavioural tests every error implementation must satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter for
 * structured errors: defaults, mutation semantics, aggregation, serialization,
 * and optional normalization behaviour.
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
          cause,
        });

        expect(error.message).toBe('Not found');
        expect(error.code).toBe(404);
        expect(error.severity).toBe('fatal');
        expect(error.reference).toBe('user:1234');
        expect(error.metadata).toEqual({userId: '1234'});
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
