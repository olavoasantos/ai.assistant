import {describe, expect, it} from 'vitest';
import {object} from '..';
import {string} from '../../string';
import {number} from '../../number';

describe('object', () => {
  it('passes valid objects matching the shape', () => {
    const schema = object({name: string(), age: number()});
    const result = schema.validate({name: 'Alice', age: 30});

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({name: 'Alice', age: 30});
  });

  it('fails null', () => {
    const schema = object({name: string()});
    const result = schema.validate(null);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.object');
  });

  it('fails arrays', () => {
    const schema = object({name: string()});
    const result = schema.validate([]);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.object');
  });

  it('fails strings', () => {
    const schema = object({name: string()});
    const result = schema.validate('hello');

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.object');
  });

  it('fails numbers', () => {
    const schema = object({name: string()});
    const result = schema.validate(42);

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.message).toBe('validation.object');
  });

  it('validates each property against its schema', () => {
    const schema = object({name: string(), age: number()});
    const result = schema.validate({name: 123, age: 'old'});

    expect(result.ok).toBe(false);
    expect(result.issues!.length).toBe(2);
  });

  it('nested issues have correct path', () => {
    const schema = object({name: string()});
    const result = schema.validate({name: 42});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.path).toEqual(['name']);
  });

  it('deeply nested paths work', () => {
    const schema = object({
      address: object({city: string()}),
    });
    const result = schema.validate({address: {city: 123}});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.path).toEqual(['address', 'city']);
  });

  it('strips extra properties by default', () => {
    const schema = object({name: string()});
    const result = schema.validate({name: 'Alice', extra: 'removed'});

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({name: 'Alice'});
    expect(result.value).not.toHaveProperty('extra');
  });

  it('rejects extra properties with extraProperties reject', () => {
    const schema = object({name: string()}, {extraProperties: 'reject'});
    const result = schema.validate({name: 'Alice', extra: 'bad'});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.path).toEqual(['extra']);
    expect(result.issues![0]!.message).toBe('validation.object.extraProperty');
  });

  it('preserves extra properties with extraProperties passthrough', () => {
    const schema = object({name: string()}, {extraProperties: 'passthrough'});
    const result = schema.validate({name: 'Alice', extra: 'kept'});

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({name: 'Alice', extra: 'kept'});
  });

  it('fails missing properties with the property validator error and path', () => {
    const schema = object({name: string()});
    const result = schema.validate({});

    expect(result.ok).toBe(false);
    expect(result.issues![0]!.path).toEqual(['name']);
    expect(result.issues![0]!.message).toBe('validation.string');
  });
});
