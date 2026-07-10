import {describe, it, expect} from 'vitest';
import {defer} from '../defer';

describe('defer', () => {
  it('should create a deferred object with a promise', () => {
    const deferred = defer<string>();
    expect(deferred).toHaveProperty('promise');
    expect(deferred).toHaveProperty('resolve');
    expect(deferred).toHaveProperty('reject');
  });

  it('should resolve the promise with the given value', async () => {
    const deferred = defer<string>();
    const value = 'test value';
    deferred.resolve(value);

    await expect(deferred.promise).resolves.toBe(value);
  });

  it('should reject the promise with the given reason', async () => {
    const deferred = defer<string>();
    const reason = new Error('test error');
    deferred.reject(reason);

    await expect(deferred.promise).rejects.toThrow(reason);
  });

  it('should resolve the promise with a default value if none is provided', async () => {
    const defaultValue = 'default value';
    const deferred = defer<string>(defaultValue);
    deferred.resolve();

    await expect(deferred.promise).resolves.toBe(defaultValue);
  });
});
