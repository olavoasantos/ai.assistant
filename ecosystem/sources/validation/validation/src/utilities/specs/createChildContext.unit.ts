import {describe, expect, it} from 'vitest';
import {createChildContext} from '../createChildContext';

describe('createChildContext', () => {
  const rootContext = {
    options: {bail: true},
    root: {a: 1},
    parent: undefined,
    path: [] as PropertyKey[],
    key: undefined,
  };

  it('returns context with parent set to the provided parent', () => {
    const parent = {name: 'test'};
    const child = createChildContext(rootContext, parent, 'name');

    expect(child.parent).toBe(parent);
  });

  it('returns context with key set to the provided key', () => {
    const child = createChildContext(rootContext, {}, 'age');

    expect(child.key).toBe('age');
  });

  it('appends key to the parent path', () => {
    const child = createChildContext(rootContext, {}, 'name');

    expect(child.path).toEqual(['name']);
  });

  it('inherits root from parent context', () => {
    const child = createChildContext(rootContext, {}, 'name');

    expect(child.root).toBe(rootContext.root);
  });

  it('inherits options from parent context', () => {
    const child = createChildContext(rootContext, {}, 'name');

    expect(child.options).toBe(rootContext.options);
  });
});
