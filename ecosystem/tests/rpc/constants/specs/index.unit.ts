import {describe, expect, it} from 'vitest';
import {RPC_TEST_CORE_BUDGET_CATEGORIES} from '..';

describe('RPC compliance constants', () => {
  it('catalogs every stable core budget category exactly once', () => {
    let categories = Object.keys(RPC_TEST_CORE_BUDGET_CATEGORIES);

    expect(categories).toHaveLength(25);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories).toContain('frame.bytes');
    expect(categories).toContain('calls.pending');
    expect(categories).toContain('plugins.state');
  });
});
