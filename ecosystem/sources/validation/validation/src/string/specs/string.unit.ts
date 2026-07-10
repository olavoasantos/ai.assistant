import {describe, expect, it} from 'vitest';
import {string} from '..';
import {minLength} from '../rules/minLength';

describe('string', () => {
  it('passes valid strings', () => {
    const schema = string();
    const result = schema.validate('hello');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('passes empty strings', () => {
    const schema = string();
    const result = schema.validate('');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('');
  });

  it('fails numbers', () => {
    const schema = string();
    const result = schema.validate(42);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string');
  });

  it('fails booleans', () => {
    const schema = string();
    const result = schema.validate(true);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string');
  });

  it('fails null', () => {
    const schema = string();
    const result = schema.validate(null);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string');
  });

  it('fails undefined', () => {
    const schema = string();
    const result = schema.validate(undefined);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string');
  });

  it('fails objects', () => {
    const schema = string();
    const result = schema.validate({});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string');
  });

  it('applies sub-rules and namespaces their message keys', () => {
    const schema = string([minLength(5)]);
    const result = schema.validate('hi');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string.minLength');
  });

  it('passes sub-rules when value satisfies them', () => {
    const schema = string([minLength(2)]);
    const result = schema.validate('hello');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('accepts options as second argument', () => {
    const schema = string(undefined, {message: 'custom'});
    const result = schema.validate(42);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('custom');
  });

  it('accepts rules and options together', () => {
    const schema = string([minLength(5)], {bail: true});
    const result = schema.validate('hi');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.string.minLength');
  });
});
