import {describe, expect, it} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/validation';

/**
 * Factories used by validation implementations to run the shared compliance suite.
 *
 * Only the foundational primitives are required: the rule constructor and the
 * two result constructors. Built-in validators (`string()`, `array()`, etc.) are
 * implementation-specific convenience factories and are NOT part of compliance.
 */
export interface ValidationComplianceTestSuite {
  /** Creates a callable rule from a contract rule descriptor. */
  createRule: <Input = unknown, Output = Input>(
    descriptor: Contract.RuleDescriptor<Input, Output>,
  ) => Contract.Rule<Input, Output>;

  /** Creates a rule success result. Without a value, the engine keeps the input. */
  Ok: <Output>(value?: Output) => Contract.OkResult<Output>;

  /** Creates a rule failure result. Without issues, the engine generates a default. */
  Err: (...issues: Contract.IssueDescriptor[]) => Contract.ErrResult;
}

/**
 * Registers the shared behavioural tests every validation implementation must satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter for
 * validation rules: result shapes, the execution pipeline, metadata mutation,
 * composition, options, the predicate API, and the interoperability facade —
 * all exercised through the foundational `createRule` / `Ok` / `Err` primitives.
 */
export function runValidationComplianceTests(factories: ValidationComplianceTestSuite): void {
  const {createRule, Ok, Err} = factories;

  describe('validation compliance', () => {
    describe('result constructors', () => {
      it('Ok() signals pass without transformation', () => {
        expect(Ok()).toEqual({ok: true});
      });

      it('Ok(value) signals pass with transformation', () => {
        expect(Ok('transformed')).toEqual({ok: true, value: 'transformed'});
      });

      it('Err() signals failure with a default issue', () => {
        expect(Err()).toEqual({ok: false});
      });

      it('Err(...issues) signals failure with explicit descriptors', () => {
        expect(Err({message: 'custom'})).toEqual({ok: false, issues: [{message: 'custom'}]});
      });
    });

    describe('rule execution pipeline', () => {
      it('returns complete success and failure result shapes', () => {
        const pass = createRule({name: 'pass', validate: () => Ok()});
        const fail = createRule({name: 'fail', validate: () => Err()});

        expect(pass.validate('value')).toEqual({ok: true, value: 'value', issues: undefined});
        expect(fail.validate('value')).toEqual({
          ok: false,
          value: undefined,
          issues: [{message: 'validation.fail', rule: 'fail'}],
        });
      });

      it('replaces the value when validate returns Ok(newValue)', () => {
        const transform = createRule<string>({
          name: 'transform',
          validate: (value) => Ok(value.toUpperCase()),
        });

        expect(transform.validate('hello')).toEqual({ok: true, value: 'HELLO', issues: undefined});
      });

      it('skips subsequent pipeline stages after a failure', () => {
        const visited: string[] = [];
        const schema = createRule<string>({
          name: 'parent',
          validate: () => Err(),
          rules: [
            createRule({
              name: 'child',
              validate: () => {
                visited.push('child');
                return Ok();
              },
            }),
          ],
          traverse: (value) => {
            visited.push('traverse');
            return {ok: true, value, issues: undefined};
          },
        });

        schema.validate('value');

        expect(visited).toEqual([]);
      });
    });

    describe('sub-rules', () => {
      it('runs sub-rules after the parent validate passes', () => {
        const child = createRule<string>({
          name: 'minLength',
          extras: {min: 3},
          validate: (value) => (value.length >= 3 ? Ok() : Err()),
        });
        const parent = createRule<string>({
          name: 'string',
          validate: () => Ok(),
          rules: [child],
        });

        expect(parent.validate('ab')).toMatchObject({
          ok: false,
          issues: [{message: 'validation.string.minLength', rule: 'minLength', extras: {min: 3}}],
        });
        expect(parent.validate('abc')).toEqual({ok: true, value: 'abc', issues: undefined});
      });

      it('sorts sub-rules by phase: pre → default → post', () => {
        const order: string[] = [];
        const schema = createRule<string>({
          name: 'parent',
          validate: () => Ok(),
          rules: [
            createRule({
              name: 'post',
              order: 'post',
              validate: () => {
                order.push('post');
                return Ok();
              },
            }),
            createRule({
              name: 'default',
              validate: () => {
                order.push('default');
                return Ok();
              },
            }),
            createRule({
              name: 'pre',
              order: 'pre',
              validate: () => {
                order.push('pre');
                return Ok();
              },
            }),
          ],
        });

        schema.validate('value');

        expect(order).toEqual(['pre', 'default', 'post']);
      });

      it('threads each sub-rule output into the next', () => {
        const schema = createRule<string>({
          name: 'parent',
          validate: () => Ok('a'),
          rules: [
            createRule<string>({name: 'append-b', validate: (value) => Ok(`${value}b`)}),
            createRule<string>({name: 'append-c', validate: (value) => Ok(`${value}c`)}),
          ],
        });

        expect(schema.validate('initial')).toEqual({ok: true, value: 'abc', issues: undefined});
      });
    });

    describe('traversal', () => {
      it('descends into children after sub-rules pass', () => {
        const child = createRule<string>({
          name: 'child',
          validate: (value) => (value === 'valid' ? Ok(value) : Err()),
        });
        const schema = createRule<string[]>({
          name: 'parent',
          validate: () => Ok(),
          traverse: (value) => {
            const issues: Contract.Issue[] = [];
            for (let i = 0; i < value.length; i++) {
              const result = child.validate(value[i]);
              if (!result.ok)
                issues.push(
                  ...result.issues.map((issue) => ({...issue, path: [i, ...(issue.path ?? [])]})),
                );
            }
            return issues.length > 0
              ? {ok: false, value: undefined, issues}
              : {ok: true, value: value, issues: undefined};
          },
        });

        expect(schema.validate(['valid', 'invalid'])).toMatchObject({
          ok: false,
          issues: [{message: 'validation.child', rule: 'child', path: [1]}],
        });
        expect(schema.validate(['valid', 'valid'])).toEqual({
          ok: true,
          value: ['valid', 'valid'],
          issues: undefined,
        });
      });
    });

    describe('issue enrichment', () => {
      it('produces structured message keys for top-level failures', () => {
        const schema = createRule({name: 'required', validate: () => Err()});

        expect(schema.validate(null)).toMatchObject({
          ok: false,
          issues: [{message: 'validation.required', rule: 'required'}],
        });
      });

      it('namespaces sub-rule message keys with the parent name', () => {
        const schema = createRule<string>({
          name: 'string',
          validate: () => Ok(),
          rules: [createRule({name: 'email', validate: () => Err()})],
        });

        expect(schema.validate('x')).toMatchObject({
          ok: false,
          issues: [{message: 'validation.string.email', rule: 'email'}],
        });
      });

      it('merges descriptor and issue extras', () => {
        const schema = createRule({
          name: 'minLength',
          extras: {min: 3},
          validate: () => Err({message: 'fail', extras: {custom: true}}),
        });

        expect(schema.validate('x')).toMatchObject({
          ok: false,
          issues: [{extras: {min: 3, custom: true}}],
        });
      });

      it('resolves factory-function extras on each validation', () => {
        const schema = createRule({
          name: 'dynamic',
          extras: () => ({generated: true}),
          validate: () => Err(),
        });

        expect(schema.validate('x')).toMatchObject({
          ok: false,
          issues: [{extras: {generated: true}}],
        });
      });
    });

    describe('options', () => {
      it('merges call-site options over schema-level defaults', () => {
        const schema = createRule<string>({
          name: 'parent',
          validate: () => Ok(),
          rules: [createRule<string>({name: 'child', validate: () => Err()})],
          options: {bail: false},
        });

        const result = schema.validate('x', {bail: true});

        expect(result).toMatchObject({ok: false});
        expect(result.issues).toHaveLength(1);
      });

      it('overrides issue messages with a call-site message option', () => {
        const schema = createRule({name: 'required', validate: () => Err()});

        expect(schema.validate(null, {message: 'custom.message'})).toMatchObject({
          ok: false,
          issues: [{message: 'custom.message'}],
        });
      });

      it('overrides issue messages with a schema-level message option', () => {
        const schema = createRule({
          name: 'required',
          validate: () => Err(),
          options: {message: 'schema.message'},
        });

        expect(schema.validate(null)).toMatchObject({
          ok: false,
          issues: [{message: 'schema.message'}],
        });
      });

      it('stops at the first failure when bail is true', () => {
        const schema = createRule<string>({
          name: 'parent',
          validate: () => Ok(),
          rules: [
            createRule<string>({name: 'first', validate: () => Err({message: 'first'})}),
            createRule<string>({name: 'second', validate: () => Err({message: 'second'})}),
          ],
          options: {bail: true},
        });

        const result = schema.validate('x');

        expect(result).toMatchObject({ok: false});
        expect(result.issues).toHaveLength(1);
      });
    });

    describe('callable and mode APIs', () => {
      const pass = () => createRule<string>({name: 'pass', validate: (value) => Ok(value)});

      it('invocation aliases validate', () => {
        const schema = pass();

        expect(schema('hello')).toEqual({ok: true, value: 'hello', issues: undefined});
        expect(schema.validate('hello')).toEqual({ok: true, value: 'hello', issues: undefined});
      });

      it('parse returns the value or undefined', () => {
        const schema = pass();
        const fail = createRule({name: 'fail', validate: () => Err()});

        expect(schema.parse('hello')).toBe('hello');
        expect(fail.parse('hello')).toBeUndefined();
      });

      it('ensureValid returns the success result or throws', () => {
        const schema = pass();
        const fail = createRule({name: 'fail', validate: () => Err()});

        expect(schema.ensureValid('hello')).toEqual({ok: true, value: 'hello', issues: undefined});
        expect(() => fail.ensureValid('hello')).toThrow('Validation failed');
      });

      it('ensureParse returns the value or throws', () => {
        const schema = pass();
        const fail = createRule({name: 'fail', validate: () => Err()});

        expect(schema.ensureParse('hello')).toBe('hello');
        expect(() => fail.ensureParse('hello')).toThrow('Validation failed');
      });

      it('is returns true on success and false on failure', () => {
        const schema = pass();
        const fail = createRule<string>({name: 'fail', validate: () => Err()});

        expect(schema.is('hello')).toBe(true);
        expect(fail.is('hello')).toBe(false);
      });
    });

    describe('metadata', () => {
      it('exposes the rule name and descriptor meta', () => {
        const schema = createRule({
          name: 'myRule',
          meta: {description: 'A rule'},
          validate: () => Ok(),
        });

        expect(schema.meta).toMatchObject({name: 'myRule', description: 'A rule'});
      });

      it('set replaces a single mutable field and returns the rule', () => {
        const schema = createRule({name: 'myRule', validate: () => Ok()});

        expect(schema.set('description', 'Updated')).toBe(schema);
        expect(schema.meta.description).toBe('Updated');
      });

      it('setMany shallow-merges metadata and preserves existing fields', () => {
        const schema = createRule({name: 'myRule', validate: () => Ok()});

        schema.set('description', 'first');
        schema.setMany({custom: 42});

        expect(schema.meta).toMatchObject({name: 'myRule', description: 'first', custom: 42});
      });

      it('exposes the execution phase', () => {
        expect(createRule({name: 'a', validate: () => Ok()}).order).toBe('default');
        expect(createRule({name: 'b', order: 'pre', validate: () => Ok()}).order).toBe('pre');
        expect(createRule({name: 'c', order: 'post', validate: () => Ok()}).order).toBe('post');
      });
    });

    describe('optional', () => {
      it('accepts undefined and returns undefined output', () => {
        const schema = createRule<string>({
          name: 'required',
          validate: (value) => (typeof value === 'string' ? Ok(value) : Err()),
        }).optional();

        expect(schema.validate(undefined)).toEqual({ok: true, value: undefined, issues: undefined});
      });

      it('passes defined values through the original rule', () => {
        const schema = createRule<string>({
          name: 'required',
          validate: (value) => (typeof value === 'string' ? Ok(value) : Err()),
        }).optional();

        expect(schema.validate('hello')).toEqual({ok: true, value: 'hello', issues: undefined});
        expect(schema.validate(42).ok).toBe(false);
      });

      it('substitutes a default when input is undefined', () => {
        const schema = createRule<string>({
          name: 'required',
          validate: (value) => Ok(value),
        }).optional('fallback');

        expect(schema.validate(undefined)).toEqual({
          ok: true,
          value: 'fallback',
          issues: undefined,
        });
      });
    });

    describe('interoperability facade', () => {
      it('exposes version, vendor, and validate', () => {
        const schema = createRule<string>({name: 'pass', validate: (value) => Ok(value)});

        expect(schema['~standard'].version).toBe(1);
        expect(schema['~standard'].vendor).toBe('ai.assistant');
        expect(schema['~standard'].validate('hello')).toEqual({value: 'hello'});
      });

      it('returns issues in the standard result shape on failure', () => {
        const schema = createRule({name: 'fail', validate: () => Err()});

        expect(schema['~standard'].validate('x')).toEqual({
          issues: [{message: 'validation.fail', path: undefined}],
        });
      });
    });
  });
}
