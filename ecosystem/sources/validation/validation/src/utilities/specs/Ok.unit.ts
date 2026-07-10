import {describe, expect, it} from 'vitest';
import {Ok} from '../Ok';

describe('Ok', () => {
  it('returns { ok: true } with no value property when called without arguments', () => {
    const result = Ok();

    expect(result).toEqual({ok: true});
    expect('value' in result).toBe(false);
  });

  it('returns { ok: true, value } when called with a string', () => {
    const result = Ok('hello');

    expect(result).toEqual({ok: true, value: 'hello'});
  });

  it('returns { ok: true, value: undefined } when explicitly passed undefined', () => {
    const result = Ok(undefined);

    expect(result).toEqual({ok: true, value: undefined});
    expect('value' in result).toBe(true);
  });

  it('returns { ok: true, value: 0 } when called with zero', () => {
    const result = Ok(0);

    expect(result).toEqual({ok: true, value: 0});
  });
});
