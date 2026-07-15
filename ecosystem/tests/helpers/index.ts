import {describe, expect, expectTypeOf, it} from 'vitest';
import type * as Contracts from '@ai.assistant/contracts/utilities';

/**
 * Factories used by helpers implementations to run the shared compliance suite.
 *
 * Helpers is a source-only entity — utility functions are self-specifying, so
 * the compliance suite verifies behavioural invariants rather than an abstract
 * interface contract. Each factory provides a concrete utility implementation.
 */
export interface HelpersComplianceTestSuite {
  /** Capitalizes the first character of a string. */
  capitalize: (str: string) => string;

  /** Creates a deferred Promise with externally controllable resolution. */
  defer: <T = void>(
    value?: T,
  ) => {
    promise: Promise<T>;
    resolve: (value?: T) => void;
    reject: (reason?: unknown) => void;
  };

  /** Deletes a nested key at a dot-separated path. */
  deletePath: (target: Record<string, unknown>, path: string) => void;

  /** Parses a `prefix://owner/resource/id` global identifier. */
  ensureGid: (value: string) => {
    prefix: string;
    owner: string;
    resource: string;
    id: string;
  };

  /** Parses a `prefix:id` internal identifier. */
  ensureId: (value: string) => {prefix: string; id: string};

  /** Generates a global identifier. */
  generateGid: (
    resourceOrOptions:
      | string
      | {resource: string; prefix?: string; owner?: string; id?: string | number},
  ) => string;

  /** Generates an internal identifier. */
  generateId: (prefix?: string) => string;

  /** Generates a random alphanumeric string of the given size. */
  generateRandomString: (size?: number) => string;

  /** Retrieves a nested value at a dot-or-bracket path. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPath: (obj: any, path: any) => any;

  /** Compiles a glob pattern into an anchored regular expression. */
  globToRegex: (glob: string) => RegExp;

  /** Sets a nested value at a pre-split path. */
  setPath: (obj: Record<string, unknown>, path: string[], value: unknown) => void;

  /** Slugifies a string: lowercase, hyphenated, ASCII-only. */
  slugify: (value: string) => string;
}

/**
 * Registers the shared behavioural tests every helpers implementation must
 * satisfy.
 *
 * The suite asserts the charter invariants for each utility: purity, format
 * conventions, error behaviour, and round-trip properties. Edge cases beyond
 * the charter are covered by source-specific unit tests.
 */
export function runHelpersComplianceTests(factories: HelpersComplianceTestSuite): void {
  const {
    capitalize,
    defer,
    deletePath,
    ensureGid,
    ensureId,
    generateGid,
    generateId,
    generateRandomString,
    getPath,
    globToRegex,
    setPath,
    slugify,
  } = factories;

  describe('helpers compliance', () => {
    describe('capitalize', () => {
      it('uppercases the first character and preserves the rest', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('helloWorld')).toBe('HelloWorld');
      });

      it('returns an empty string unchanged', () => {
        expect(capitalize('')).toBe('');
      });
    });

    describe('slugify', () => {
      it('lowercases and hyphenates spaces', () => {
        expect(slugify('Hello World')).toBe('hello-world');
      });

      it('strips diacritics', () => {
        expect(slugify('café résumé')).toBe('cafe-resume');
      });

      it('removes non-alphanumeric characters except hyphens', () => {
        expect(slugify('foo! bar?')).toBe('foo-bar');
      });
    });

    describe('generateRandomString', () => {
      it('produces a string of the requested size', () => {
        expect(generateRandomString(16)).toHaveLength(16);
      });

      it('defaults to size 8', () => {
        expect(generateRandomString()).toHaveLength(8);
      });

      it('clamps to a minimum of 1', () => {
        expect(generateRandomString(0)).toHaveLength(1);
        expect(generateRandomString(-5)).toHaveLength(1);
      });

      it('produces only lowercase alphanumeric characters', () => {
        expect(generateRandomString(100)).toMatch(/^[a-z0-9]+$/);
      });

      it('produces unique output across many calls', () => {
        const results = new Set<string>();
        for (let i = 0; i < 1000; i++) {
          results.add(generateRandomString(16));
        }
        expect(results.size).toBe(1000);
      });
    });

    describe('generateId', () => {
      it('produces a prefix:id format', () => {
        expect(generateId('test')).toMatch(/^test:[a-z0-9]+$/);
      });

      it('defaults to the ai.assistant prefix', () => {
        expect(generateId()).toMatch(/^ai\.assistant:[a-z0-9]+$/);
      });

      it('produces unique output across many calls', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 1000; i++) {
          ids.add(generateId('test'));
        }
        expect(ids.size).toBe(1000);
      });
    });

    describe('generateGid', () => {
      it('produces a prefix://owner/resource/id format from a string', () => {
        expect(generateGid('Session')).toMatch(/^gid:\/\/ai\.assistant\/Session\/[a-z0-9]+$/);
      });

      it('uses defaults for prefix and owner when only resource is given', () => {
        const id = generateGid({resource: 'Agent'});
        expect(id).toMatch(/^gid:\/\/ai\.assistant\/Agent\/[a-z0-9]+$/);
      });

      it('uses custom prefix, owner, and id when provided', () => {
        expect(generateGid({prefix: 'urn', owner: 'acme', resource: 'Document', id: 'final'})).toBe(
          'urn://acme/Document/final',
        );
      });

      it('stringifies numeric ids', () => {
        expect(generateGid({resource: 'Agent', id: 42})).toBe('gid://ai.assistant/Agent/42');
      });
    });

    describe('ensureId', () => {
      it('parses a valid identifier into prefix and id', () => {
        expect(ensureId('ai.assistant:abc123')).toEqual({
          prefix: 'ai.assistant',
          id: 'abc123',
        });
      });

      it('splits only on the first colon', () => {
        expect(ensureId('app:complex:id')).toEqual({prefix: 'app', id: 'complex:id'});
      });

      it('throws TypeError for malformed input', () => {
        expect(() => ensureId('')).toThrow(TypeError);
        expect(() => ensureId('nocolon')).toThrow(TypeError);
        expect(() => ensureId(':abc')).toThrow(TypeError);
        expect(() => ensureId('prefix:')).toThrow(TypeError);
      });

      it('round-trips with generateId', () => {
        const parsed = ensureId(generateId('test'));
        expect(parsed.prefix).toBe('test');
        expect(parsed.id).toHaveLength(8);
      });
    });

    describe('ensureGid', () => {
      it('parses a valid GID into four parts', () => {
        expect(ensureGid('gid://ai.assistant/Session/abc123')).toEqual({
          prefix: 'gid',
          owner: 'ai.assistant',
          resource: 'Session',
          id: 'abc123',
        });
      });

      it('throws TypeError for malformed input', () => {
        expect(() => ensureGid('')).toThrow(TypeError);
        expect(() => ensureGid('gid:ai.assistant/Session/123')).toThrow(TypeError);
        expect(() => ensureGid('://ai.assistant/Session/123')).toThrow(TypeError);
        expect(() => ensureGid('gid:///Session/123')).toThrow(TypeError);
        expect(() => ensureGid('gid://ai.assistant//123')).toThrow(TypeError);
        expect(() => ensureGid('gid://ai.assistant/Session/')).toThrow(TypeError);
        expect(() => ensureGid('gid://ai.assistant/Session')).toThrow(TypeError);
      });

      it('rejects ids containing slashes', () => {
        expect(() => ensureGid('gid://ai.assistant/Session/path/to/thing')).toThrow(TypeError);
      });

      it('round-trips with generateGid', () => {
        const parsed = ensureGid(generateGid('Session'));
        expect(parsed.prefix).toBe('gid');
        expect(parsed.owner).toBe('ai.assistant');
        expect(parsed.resource).toBe('Session');
        expect(parsed.id).toHaveLength(8);
      });
    });

    describe('globToRegex', () => {
      it('matches exact strings without wildcards', () => {
        const regex = globToRegex('tool:started');
        expect(regex.test('tool:started')).toBe(true);
        expect(regex.test('tool:ended')).toBe(false);
      });

      it('matches substrings via the * wildcard', () => {
        const regex = globToRegex('tool:*');
        expect(regex.test('tool:started')).toBe(true);
        expect(regex.test('tool:ended')).toBe(true);
        expect(regex.test('turn:started')).toBe(false);
      });

      it('escapes regex special characters literally', () => {
        const regex = globToRegex('tool.call+done');
        expect(regex.test('tool.call+done')).toBe(true);
        expect(regex.test('toolxcallxdone')).toBe(false);
      });

      it('anchors matches to the full string', () => {
        const regex = globToRegex('tool:*');
        expect(regex.test('prefix tool:started suffix')).toBe(false);
      });

      it('caches compiled regexes for the same glob', () => {
        expect(globToRegex('tool:*')).toBe(globToRegex('tool:*'));
      });
    });

    describe('getPath', () => {
      const data = {user: {profile: {name: 'Ada', age: 37}}};

      it('retrieves a nested value at a dot path', () => {
        expect(getPath(data, 'user.profile.name')).toBe('Ada');
        expect(getPath(data, 'user.profile.age')).toBe(37);
      });

      it('returns undefined for a missing path', () => {
        expect(getPath(data, 'user.profile.email')).toBeUndefined();
      });

      it('returns the entire object for an empty path', () => {
        expect(getPath(data, '')).toBe(data);
      });

      it('returns undefined for null or undefined objects', () => {
        expect(getPath(null, 'user.profile.name')).toBeUndefined();
        expect(getPath(undefined, 'user.profile.name')).toBeUndefined();
      });
    });

    describe('setPath', () => {
      it('sets a nested value creating intermediate objects', () => {
        const target: Record<string, unknown> = {};
        setPath(target, ['a', 'b', 'c'], 42);
        expect(target).toEqual({a: {b: {c: 42}}});
      });

      it('overwrites an existing value', () => {
        const target = {a: {b: 1}};
        setPath(target, ['a', 'b'], 99);
        expect(target).toEqual({a: {b: 99}});
      });

      it('replaces non-object intermediates with objects', () => {
        const target: Record<string, unknown> = {a: 'string'};
        setPath(target, ['a', 'b'], 42);
        expect((target.a as Record<string, unknown>).b).toBe(42);
      });
    });

    describe('deletePath', () => {
      it('deletes a nested key at a dot path', () => {
        const target = {a: {b: {c: 42, d: 99}}};
        deletePath(target, 'a.b.c');
        expect(target.a.b).toEqual({d: 99});
      });

      it('is a no-op when an intermediate key is missing', () => {
        const target = {a: {b: 1}};
        deletePath(target, 'a.x.y');
        expect(target).toEqual({a: {b: 1}});
      });

      it('removes the key entirely rather than setting it to undefined', () => {
        const target: Record<string, unknown> = {a: 1};
        deletePath(target, 'a');
        expect('a' in target).toBe(false);
      });
    });

    describe('defer', () => {
      it('creates an object with promise, resolve, and reject', () => {
        const deferred = defer<string>();
        expect(deferred).toHaveProperty('promise');
        expect(deferred).toHaveProperty('resolve');
        expect(deferred).toHaveProperty('reject');
      });

      it('resolves the promise with the given value', async () => {
        const deferred = defer<string>();
        deferred.resolve('value');
        await expect(deferred.promise).resolves.toBe('value');
      });

      it('rejects the promise with the given reason', async () => {
        const deferred = defer<string>();
        const reason = new Error('boom');
        deferred.reject(reason);
        await expect(deferred.promise).rejects.toThrow(reason);
      });

      it('uses the construction value as default when resolve is called without an argument', async () => {
        const deferred = defer<string>('default');
        deferred.resolve();
        await expect(deferred.promise).resolves.toBe('default');
      });
    });

    describe('shared types', () => {
      it('MaybeAsync is available from contracts', () => {
        expectTypeOf<Contracts.MaybeAsync<string>>().toEqualTypeOf<string | Promise<string>>();
      });
    });
  });
}
