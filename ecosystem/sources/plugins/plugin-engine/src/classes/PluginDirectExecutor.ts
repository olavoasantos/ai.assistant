import type * as Contracts from '@ai.assistant/contracts/plugins';
import {ApplicationError} from '@ai.assistant/error';
import type {PreparedRunnerEntry} from '../types';

/**
 * Bounded synchronous executor for one prepared plugin hook.
 *
 * Instances are created and invalidated by {@link PluginContainer}. Every
 * invocation remains runner-owned so ordering, context, caching, and error
 * policy stay aligned with ordinary strategies without per-call telemetry.
 *
 * @template Handler - The prepared hook handler type.
 */
export class PluginDirectExecutor<
  Handler extends (...args: any[]) => any,
> implements Contracts.PluginDirectExecutor<Handler> {
  /** Whether the enclosing direct scope is still active. */
  private active = true;

  /** Prepared entries in normalized execution order. */
  private readonly entries: PreparedRunnerEntry[];

  /**
   * Creates an executor over a prepared membership snapshot.
   *
   * @param entries - Prepared runner entries in execution order.
   */
  constructor(entries: PreparedRunnerEntry[]) {
    this.entries = entries;
  }

  /** Runs every prepared handler in order. */
  sequential(args: Parameters<Handler>): void {
    this.ensureActive();
    for (const entry of this.entries) {
      entry.runner.invokePreparedSync(entry.invocation, args, {cache: true});
    }
  }

  /** Returns the first non-null result from the prepared handlers. */
  first(args: Parameters<Handler>): ReturnType<Handler> | undefined {
    this.ensureActive();
    for (const entry of this.entries) {
      const result = entry.runner.invokePreparedSync(entry.invocation, args, {cache: true});
      if (result.value != null) return result.value as ReturnType<Handler>;
    }
    return undefined;
  }

  /** Folds prepared handler results into an accumulator. */
  reduce<Accumulator>(
    options: Contracts.PluginDirectReduceOptions<Handler, Accumulator>,
  ): Accumulator {
    this.ensureActive();
    let accumulator = options.initial;
    for (const entry of this.entries) {
      const result = entry.runner.invokePreparedSync(entry.invocation, options.args, {cache: true});
      if (result.value !== undefined) {
        accumulator = options.reduce(accumulator, result.value as ReturnType<Handler>);
      }
    }
    return accumulator;
  }

  /** Invalidates the executor after its enclosing callback returns. */
  close(): void {
    this.active = false;
  }

  /** Throws when execution is attempted outside the bounded scope. */
  private ensureActive(): void {
    if (!this.active) {
      throw new ApplicationError({
        message: 'Cannot use a plugin direct executor outside its execution scope.',
        code: 500,
      });
    }
  }
}
