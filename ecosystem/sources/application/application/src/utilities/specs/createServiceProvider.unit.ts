import {describe, expect, expectTypeOf, it} from 'vitest';
import {createServiceProvider} from '../createServiceProvider';

describe('createServiceProvider', () => {
  it('wraps a fixed definition in a factory', () => {
    const definition = {name: 'configuration'} as const;
    const factory = createServiceProvider(definition);

    expect(factory()).toBe(definition);
    expectTypeOf(factory().name).toEqualTypeOf<'configuration'>();
  });

  it('preserves a parameterized factory', () => {
    const factory = createServiceProvider((enabled: boolean) => ({
      name: 'feature' as const,
      enabled,
    }));

    expect(factory(true)).toEqual({name: 'feature', enabled: true});
    expectTypeOf(factory).parameters.toEqualTypeOf<[enabled: boolean]>();
  });
});
