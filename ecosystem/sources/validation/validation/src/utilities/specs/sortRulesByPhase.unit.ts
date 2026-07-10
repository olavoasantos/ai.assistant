import {describe, expect, it} from 'vitest';
import {sortRulesByPhase} from '../sortRulesByPhase';
import {createRule} from '../../custom/rule';
import {Ok} from '../Ok';

function makeRule(name: string, order: 'pre' | 'default' | 'post') {
  return createRule({name, order, validate: () => Ok()});
}

describe('sortRulesByPhase', () => {
  it('sorts rules to pre → default → post', () => {
    const post = makeRule('post-rule', 'post');
    const pre = makeRule('pre-rule', 'pre');
    const def = makeRule('default-rule', 'default');

    const sorted = sortRulesByPhase([post, pre, def]);

    expect(sorted.map((r) => r.meta.name)).toEqual(['pre-rule', 'default-rule', 'post-rule']);
  });

  it('retains relative order within the same phase', () => {
    const a = makeRule('a', 'default');
    const b = makeRule('b', 'default');
    const c = makeRule('c', 'default');

    const sorted = sortRulesByPhase([a, b, c]);

    expect(sorted.map((r) => r.meta.name)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array when given an empty array', () => {
    const sorted = sortRulesByPhase([]);

    expect(sorted).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    const rule = makeRule('only', 'post');
    const sorted = sortRulesByPhase([rule]);

    expect(sorted).toHaveLength(1);
    expect(sorted[0].meta.name).toBe('only');
  });
});
