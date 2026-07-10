import {describe, expect, it} from 'vitest';
import {number} from '..';
import {min} from '../rules/min';

describe('number', () => {
  it('passes integers', () => {
    const schema = number();
    const result = schema.validate(42);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('passes floats', () => {
    const schema = number();
    const result = schema.validate(3.14);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(3.14);
  });

  it('passes negative numbers', () => {
    const schema = number();
    const result = schema.validate(-10);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(-10);
  });

  it('passes zero', () => {
    const schema = number();
    const result = schema.validate(0);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
  });

  it('fails strings', () => {
    const schema = number();
    const result = schema.validate('42');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number');
  });

  it('fails booleans', () => {
    const schema = number();
    const result = schema.validate(true);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number');
  });

  it('fails null', () => {
    const schema = number();
    const result = schema.validate(null);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number');
  });

  it('fails undefined', () => {
    const schema = number();
    const result = schema.validate(undefined);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number');
  });

  it('fails NaN', () => {
    const schema = number();
    const result = schema.validate(NaN);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number');
  });

  it('applies sub-rules', () => {
    const schema = number([min(10)]);
    const result = schema.validate(5);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.number.min');
  });

  it('passes sub-rules when value satisfies them', () => {
    const schema = number([min(10)]);
    const result = schema.validate(15);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(15);
  });
});
