import {describe, expect, it} from 'vitest';
import {boolean} from '..';

describe('boolean', () => {
  it('passes true', () => {
    const schema = boolean();
    const result = schema.validate(true);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it('passes false', () => {
    const schema = boolean();
    const result = schema.validate(false);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
  });

  it('fails 0', () => {
    const schema = boolean();
    const result = schema.validate(0);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });

  it('fails 1', () => {
    const schema = boolean();
    const result = schema.validate(1);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });

  it('fails empty string', () => {
    const schema = boolean();
    const result = schema.validate('');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });

  it('fails string "true"', () => {
    const schema = boolean();
    const result = schema.validate('true');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });

  it('fails null', () => {
    const schema = boolean();
    const result = schema.validate(null);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });

  it('fails undefined', () => {
    const schema = boolean();
    const result = schema.validate(undefined);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.boolean');
  });
});
