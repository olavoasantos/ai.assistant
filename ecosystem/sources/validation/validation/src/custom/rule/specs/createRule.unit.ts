import {describe, expect, it} from 'vitest';
import {createRule} from '..';
import {Ok} from '../../../utilities/Ok';
import {Err} from '../../../utilities/Err';

describe('createRule', () => {
  describe('basic validation', () => {
    it('passes through value when validate returns Ok()', () => {
      const rule = createRule({name: 'pass', validate: () => Ok()});
      const result = rule.validate('hello');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('produces structured message key when validate returns Err()', () => {
      const rule = createRule({name: 'required', validate: () => Err()});
      const result = rule.validate(null);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].message).toBe('validation.required');
      }
    });
  });

  describe('transform', () => {
    it('replaces value when validate returns Ok(newValue)', () => {
      const rule = createRule<string>({
        name: 'trim',
        validate: (v) => Ok(v.trim()),
      });
      const result = rule.validate('  hello  ');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('hello');
    });
  });

  describe('sub-rules', () => {
    it('applies sub-rules with parent name in message key', () => {
      const sub = createRule<string>({
        name: 'minLength',
        validate: (v) => (v.length >= 3 ? Ok() : Err()),
      });
      const parent = createRule<string>({
        name: 'string',
        validate: () => Ok(),
        rules: [sub],
      });

      const result = parent.validate('ab');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].message).toBe('validation.string.minLength');
      }
    });

    it('runs pre rules before default rules', () => {
      const order: string[] = [];
      const preRule = createRule<string>({
        name: 'pre',
        order: 'pre',
        validate: () => {
          order.push('pre');
          return Ok();
        },
      });
      const defaultRule = createRule<string>({
        name: 'default',
        order: 'default',
        validate: () => {
          order.push('default');
          return Ok();
        },
      });
      const parent = createRule<string>({
        name: 'test',
        validate: () => Ok(),
        rules: [defaultRule, preRule],
      });

      parent.validate('x');

      expect(order).toEqual(['pre', 'default']);
    });
  });

  describe('bail mode', () => {
    it('stops at first failure when bail is true', () => {
      const failA = createRule<string>({
        name: 'failA',
        validate: () => Err({message: 'a'}),
      });
      const failB = createRule<string>({
        name: 'failB',
        validate: () => Err({message: 'b'}),
      });
      const parent = createRule<string>({
        name: 'test',
        validate: () => Ok(),
        rules: [failA, failB],
        options: {bail: true},
      });

      const result = parent.validate('x');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toHaveLength(1);
      }
    });
  });

  describe('parse', () => {
    it('returns the value on success', () => {
      const rule = createRule<string>({name: 'pass', validate: () => Ok()});

      expect(rule.parse('hello')).toBe('hello');
    });

    it('returns undefined on failure', () => {
      const rule = createRule({name: 'fail', validate: () => Err()});

      expect(rule.parse(null)).toBeUndefined();
    });
  });

  describe('ensureParse', () => {
    it('returns the value directly on success', () => {
      const rule = createRule<string>({name: 'pass', validate: () => Ok()});

      expect(rule.ensureParse('hello')).toBe('hello');
    });

    it('throws an error with message "Validation failed" on failure', () => {
      const rule = createRule({name: 'fail', validate: () => Err()});

      expect(() => rule.ensureParse(null)).toThrow('Validation failed');
    });
  });

  describe('ensureValid', () => {
    it('returns the success result on success', () => {
      const rule = createRule<string>({name: 'pass', validate: () => Ok()});
      const result = rule.ensureValid('hello');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('hello');
      expect(result.issues).toBeUndefined();
    });

    it('throws an error on failure', () => {
      const rule = createRule({name: 'fail', validate: () => Err()});

      expect(() => rule.ensureValid(null)).toThrow('Validation failed');
    });
  });

  describe('set', () => {
    it('sets a single meta field', () => {
      const rule = createRule({name: 'test', validate: () => Ok()});
      rule.set('description', 'A test rule');

      expect(rule.meta.description).toBe('A test rule');
    });

    it('returns the rule for chaining', () => {
      const rule = createRule({name: 'test', validate: () => Ok()});
      const result = rule.set('description', 'A test rule');

      expect(result).toBe(rule);
    });
  });

  describe('setMany', () => {
    it('merges multiple metadata fields', () => {
      const rule = createRule({name: 'test', validate: () => Ok()});
      rule.setMany({description: 'A test rule', custom: 42});

      expect(rule.meta.description).toBe('A test rule');
      expect(rule.meta.custom).toBe(42);
    });

    it('preserves existing metadata fields', () => {
      const rule = createRule({name: 'test', validate: () => Ok()});
      rule.set('description', 'first');
      rule.setMany({custom: 42});

      expect(rule.meta.description).toBe('first');
      expect(rule.meta.custom).toBe(42);
    });
  });

  describe('optional', () => {
    it('accepts undefined and returns undefined', () => {
      const rule = createRule<string>({
        name: 'test',
        validate: (v) => (typeof v === 'string' ? Ok() : Err()),
      });
      const optional = rule.optional();
      const result = optional.validate(undefined);

      expect(result.ok).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('passes through defined values to the original rule', () => {
      const rule = createRule<string>({
        name: 'test',
        validate: (v) => (typeof v === 'string' ? Ok() : Err()),
      });
      const optional = rule.optional();
      const result = optional.validate('hello');

      expect(result.ok).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('uses default value when input is undefined', () => {
      const rule = createRule<string>({
        name: 'test',
        validate: () => Ok(),
      });
      const optional = rule.optional('fallback');
      const result = optional.validate(undefined);

      expect(result.ok).toBe(true);
      expect(result.value).toBe('fallback');
    });
  });

  describe('optional edge cases', () => {
    it('forwards call-site options to inner rule', () => {
      const failA = createRule<string>({name: 'failA', validate: () => Err()});
      const failB = createRule<string>({name: 'failB', validate: () => Err()});
      const schema = createRule<unknown, string>({
        name: 'test',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
        rules: [failA, failB],
      }).optional();

      const result = schema.validate('x', {bail: true});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toHaveLength(1);
      }
    });

    it('preserves validation context for inner rule', () => {
      let capturedParent: unknown;
      const contextReader = createRule<string>({
        name: 'contextReader',
        validate: (_v, ctx) => {
          capturedParent = ctx.parent;
          return Ok();
        },
      });
      const schema = createRule<unknown, string>({
        name: 'test',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
        rules: [contextReader],
      }).optional();

      const parentObj = {field: 'hello'};
      // Simulate being called as a child within an object traversal
      schema.validate('hello', {
        _context: {options: {}, root: {}, parent: parentObj, path: ['field'], key: 'field'},
        _parentName: 'object',
      } as any);

      expect(capturedParent).toBe(parentObj);
    });

    it('fails defined values through inner validation', () => {
      const schema = createRule<unknown, string>({
        name: 'test',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
      }).optional();

      const result = schema.validate(42);
      expect(result.ok).toBe(false);
    });

    it('preserves sub-rule attribution on failure', () => {
      const sub = createRule<string>({
        name: 'minLength',
        extras: {min: 3},
        validate: (v) => (v.length >= 3 ? Ok() : Err()),
      });
      const schema = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
        rules: [sub],
      }).optional();

      const result = schema.validate('ab');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].rule).toBe('minLength');
        expect(result.issues[0].extras).toEqual({min: 3});
      }
    });
  });

  describe('is', () => {
    it('returns true when value passes validation', () => {
      const rule = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
      });

      expect(rule.is('hello')).toBe(true);
    });

    it('returns false when value fails validation', () => {
      const rule = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
      });

      expect(rule.is(42)).toBe(false);
    });

    it('narrows the type in control flow', () => {
      const rule = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
      });
      const value: unknown = 'hello';

      if (rule.is(value)) {
        // TypeScript narrows value to string
        expect(value.toUpperCase()).toBe('HELLO');
      } else {
        expect.fail('Expected value to pass validation');
      }
    });

    it('respects sub-rules', () => {
      const minLength = createRule<string>({
        name: 'minLength',
        validate: (v) => (v.length >= 3 ? Ok() : Err()),
      });
      const rule = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
        rules: [minLength],
      });

      expect(rule.is('ab')).toBe(false);
      expect(rule.is('abc')).toBe(true);
    });

    it('works with optional rules', () => {
      const rule = createRule<unknown, string>({
        name: 'string',
        validate: (v) => (typeof v === 'string' ? Ok(v) : Err()),
      }).optional();

      expect(rule.is(undefined)).toBe(true);
      expect(rule.is('hello')).toBe(true);
      expect(rule.is(42)).toBe(false);
    });

    it('is unsound for transforming rules (documents known limitation)', () => {
      const rule = createRule<string, number>({
        name: 'toNumber',
        validate: (v) => (typeof v === 'string' ? Ok(Number(v)) : Err()),
      });

      // .is() returns true because validation succeeds, but the original
      // value is still a string. The type predicate narrows to `number`
      // which is incorrect for the runtime value. This is a known limitation
      // documented in the contract and charter.
      expect(rule.is('42')).toBe(true);
      expect(rule.parse('42')).toBe(42);
    });
  });

  describe('meta', () => {
    it('has correct name from descriptor', () => {
      const rule = createRule({name: 'myRule', validate: () => Ok()});

      expect(rule.meta.name).toBe('myRule');
    });
  });

  describe('~standard', () => {
    it('has version 1 and vendor ai.assistant', () => {
      const rule = createRule({name: 'test', validate: () => Ok()});
      const standard = rule['~standard'];

      expect(standard.version).toBe(1);
      expect(standard.vendor).toBe('ai.assistant');
    });

    it('has a validate method that returns standard-schema result', () => {
      const rule = createRule<string>({name: 'test', validate: () => Ok()});
      const result = rule['~standard'].validate('hello');

      expect(result).toEqual({value: 'hello'});
    });
  });

  describe('extras', () => {
    it('includes descriptor extras in issue extras', () => {
      const rule = createRule({
        name: 'minLength',
        extras: {min: 3},
        validate: () => Err(),
      });
      const result = rule.validate('ab');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].extras).toEqual({min: 3});
      }
    });
  });
});
