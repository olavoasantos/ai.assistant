/**
 * A constructor type describing a instantiable class with static methods.
 *
 * @template Instance - The instance type produced by `new`.
 * @template Params - The constructor parameter tuple.
 * @template StaticMethods - Static members attached to the constructor function.
 */
export type Constructor<
  Instance = unknown,
  Params extends Array<unknown> = any[],
  StaticMethods extends Record<string, any> = {},
> = {
  new (...args: Params): Instance;
} & StaticMethods;
