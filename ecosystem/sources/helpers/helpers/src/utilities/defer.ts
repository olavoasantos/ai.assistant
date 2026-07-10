/** A deferred Promise with externally controllable resolution. */
export interface Defer<T = void> {
  /** The pending promise. */
  promise: Promise<T>;
  /** Resolves the promise with an optional value. */
  resolve: (value?: T) => void;
  /** Rejects the promise with an optional reason. */
  reject: (reason?: any) => void;
}

/**
 * Creates a deferred Promise whose resolution can be controlled externally.
 *
 * If a `value` is provided at construction, it becomes the default used when
 * `resolve()` is called without an argument.
 *
 * @template T - The resolved value type.
 * @param value - Optional default value used when `resolve()` is called bare.
 * @returns A {@link Defer} containing the promise and its control functions.
 *
 * @example
 * ```ts
 * const deferred = defer<string>();
 * deferred.resolve('done');
 * await deferred.promise; // → 'done'
 * ```
 */
export function defer<T = void>(value?: T): Defer<T> {
  const deferrable: Defer<T> = {
    promise: Promise.resolve(value as T),
    resolve: (v = value) => v,
    reject: (reason) => reason,
  };

  deferrable.promise = new Promise<T>((res, rej) => {
    deferrable.resolve = (v = value) => res(v as T);
    deferrable.reject = rej;
  });

  return deferrable;
}
