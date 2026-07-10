import {describe, expect, it} from 'vitest';
import {createValidationContext} from '../createValidationContext';

describe('createValidationContext', () => {
  it('returns context with root set to the input value', () => {
    const value = {name: 'test'};
    const context = createValidationContext(value, {});

    expect(context.root).toBe(value);
  });

  it('returns context with parent undefined', () => {
    const context = createValidationContext('hello', {});

    expect(context.parent).toBeUndefined();
  });

  it('returns context with empty path', () => {
    const context = createValidationContext('hello', {});

    expect(context.path).toEqual([]);
  });

  it('returns context with key undefined', () => {
    const context = createValidationContext('hello', {});

    expect(context.key).toBeUndefined();
  });

  it('returns context with the provided options', () => {
    const options = {bail: true};
    const context = createValidationContext('hello', options);

    expect(context.options).toBe(options);
  });
});
