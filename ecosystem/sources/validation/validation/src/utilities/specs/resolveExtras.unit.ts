import {describe, expect, it} from 'vitest';
import {resolveExtras} from '../resolveExtras';

describe('resolveExtras', () => {
  it('returns an empty object when extras is undefined', () => {
    const result = resolveExtras({extras: undefined});

    expect(result).toEqual({});
  });

  it('returns the object when extras is a plain object', () => {
    const extras = {min: 3, max: 10};
    const result = resolveExtras({extras});

    expect(result).toEqual({min: 3, max: 10});
  });

  it('calls the function and returns the result when extras is a function', () => {
    const result = resolveExtras({extras: () => ({computed: true})});

    expect(result).toEqual({computed: true});
  });
});
