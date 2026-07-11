import {describe, expect, expectTypeOf, it} from 'vitest';
import {createKernel} from '../createKernel';

describe('createKernel', () => {
  it('wraps a fixed definition in a factory', () => {
    const definition = {name: 'worker'} as const;
    const factory = createKernel(definition);

    expect(factory()).toBe(definition);
    expectTypeOf(factory().name).toEqualTypeOf<'worker'>();
  });

  it('preserves a parameterized factory', () => {
    const factory = createKernel((port: number) => ({name: 'server' as const, port}));

    expect(factory(3000)).toEqual({name: 'server', port: 3000});
    expectTypeOf(factory).parameters.toEqualTypeOf<[port: number]>();
  });
});
