import type {ErrorSeverity} from '@ai.assistant/contracts/error';
import type {
  HookCacheOptions,
  HookContext,
  HookOrder,
  Plugin,
} from '@ai.assistant/contracts/plugins';

/** Event map for {@link PluginRunner} lifecycle events. */
export interface PluginRunnerEvents {
  'plugin:hook.errored': {plugin: string; hook: string; error: unknown};
  'plugin:hook.cache.hit': {plugin: string; hook: string; key: string};
}

/** Event map for {@link PluginContainer} lifecycle events. */
export interface PluginContainerEvents {
  'plugin:added': {plugin: string};
  'plugin:removed': {plugin: string};
  'plugin:protected': {plugin: string};
  'plugin:container.forked': {childSize: number};
  'plugin:container.frozen': undefined;
  'plugin:container.disposed': undefined;
  'plugin:hook.errored': {hook: string; error: unknown};
  'plugin:observation.errored': {hook: string; error: unknown};
}

/** Normalized form of a hook — bare functions and object forms unified. */
export interface NormalizedHook {
  /** The hook handler function. */
  handler: (...args: any[]) => any;

  /** Ordering bucket: `'pre'`, `'post'`, or `undefined` (normal). */
  order: HookOrder | undefined;

  /** Per-hook error policy callback, or `undefined` when errors always halt. */
  errorHandler: ((thrown: unknown, ...args: any[]) => ErrorSeverity) | undefined;

  /** Per-hook cache control callback, or `undefined` when caching is disabled. */
  cacheHandler: ((...args: any[]) => HookCacheOptions) | undefined;

  /** Whether this hook opts into sequential execution within a parallel strategy. */
  sequential: boolean;
}

/** A prepared hook invocation retaining runner-owned execution semantics. */
export interface PreparedInvocation {
  /** Hook name used for caching and diagnostics. */
  hookName: string;

  /** Normalized hook definition. */
  hook: NormalizedHook;

  /** Readonly plugin context prepared for the enclosing execution scope. */
  view: HookContext;
}

/** Options controlling a prepared runner invocation. */
export interface PreparedInvocationOptions {
  /** Whether configured hook caching applies to this invocation. */
  cache: boolean;
}

/** Result from a prepared invocation, including recovery information. */
export interface PreparedInvocationResult {
  /** Whether the hook failed under a recoverable error policy. */
  recovered: boolean;

  /** Hook return value, or `undefined` after recovery. */
  value: any;
}

/** One prepared runner entry inside a bounded direct execution scope. */
export interface PreparedRunnerEntry {
  /** Runner that owns execution policy and caching. */
  runner: any;

  /** Prepared hook and readonly context. */
  invocation: PreparedInvocation;
}

/** A resolved entry in the sorted hook list for container execution. */
export interface SortedRunnerEntry {
  /** The runner that owns this hook. */
  runner: any;

  /** The plugin that owns this hook. */
  plugin: Plugin<any>;

  /** The normalized hook metadata and handler. */
  hook: NormalizedHook;
}

/** A cached hook result with optional expiration. */
export interface CacheEntry {
  /** The cached return value. */
  value: unknown;

  /** Absolute timestamp (ms) when this entry expires, or `undefined` for no expiration. */
  expiresAt: number | undefined;
}
