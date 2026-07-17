import {RPC_TEST_SCHEDULER_MAX_STEPS} from '../constants';
import type {
  RpcTestScheduledCallback,
  RpcTestScheduledTask,
  RpcTestScheduler,
  RpcTestScheduleOptions,
} from '../types';

/**
 * Virtual scheduler for deterministic RPC delivery and lifecycle tests.
 *
 * Tasks run by deadline and then insertion order. Virtual time changes only
 * through explicit execution or advancement, so tests never depend on wall
 * clocks, ambient timers, or garbage collection.
 */
export class DeterministicRpcTestScheduler implements RpcTestScheduler {
  private currentTime = 0;
  private nextSequence = 0;
  private readonly scheduled: RpcTestScheduledTask[] = [];
  private readonly callbacks = new Map<RpcTestScheduledTask, RpcTestScheduledCallback>();
  private readonly cancelledTasks = new WeakSet<RpcTestScheduledTask>();
  private readonly completedTasks = new WeakSet<RpcTestScheduledTask>();

  /** Current non-negative finite virtual time. */
  get now(): number {
    return this.currentTime;
  }

  /** Number of non-cancelled tasks awaiting execution. */
  get pending(): number {
    return this.tasks.length;
  }

  /** Immutable pending tasks in deadline and insertion order. */
  get tasks(): readonly RpcTestScheduledTask[] {
    return this.scheduled
      .filter((task) => !task.cancelled && !task.completed)
      .toSorted((left, right) => left.deadline - right.deadline || left.sequence - right.sequence);
  }

  /** Schedules one callback relative to current virtual time. */
  schedule(
    callback: RpcTestScheduledCallback,
    options: RpcTestScheduleOptions = {},
  ): RpcTestScheduledTask {
    let delay = options.delay ?? 0;

    if (!Number.isFinite(delay) || delay < 0) {
      throw new RangeError('RPC test task delay must be a non-negative finite number.');
    }

    let scheduler = this;
    let task: RpcTestScheduledTask;
    task = {
      sequence: this.nextSequence++,
      deadline: this.currentTime + delay,
      label: options.label,
      get cancelled() {
        return scheduler.cancelledTasks.has(task);
      },
      get completed() {
        return scheduler.completedTasks.has(task);
      },
      cancel() {
        if (task.cancelled || task.completed) {
          return false;
        }

        scheduler.cancelledTasks.add(task);
        scheduler.callbacks.delete(task);
        let index = scheduler.scheduled.indexOf(task);

        if (index >= 0) {
          scheduler.scheduled.splice(index, 1);
        }

        return true;
      },
    };

    this.scheduled.push(task);
    this.callbacks.set(task, callback);
    return task;
  }

  /** Runs the next pending task and reports whether one ran. */
  async runNext(): Promise<boolean> {
    let task = this.tasks[0];

    if (task === undefined) {
      return false;
    }

    let callback = this.callbacks.get(task);
    this.callbacks.delete(task);
    this.scheduled.splice(this.scheduled.indexOf(task), 1);
    this.currentTime = Math.max(this.currentTime, task.deadline);

    try {
      await callback?.();
    } finally {
      this.completedTasks.add(task);
    }

    return true;
  }

  /** Advances by a non-negative duration and runs every due task. */
  async advanceBy(duration: number): Promise<number> {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new RangeError('RPC test scheduler duration must be a non-negative finite number.');
    }

    return this.advanceTo(this.currentTime + duration);
  }

  /** Advances to a non-decreasing virtual time and runs every due task. */
  async advanceTo(time: number): Promise<number> {
    if (!Number.isFinite(time) || time < this.currentTime) {
      throw new RangeError('RPC test scheduler time must be finite and cannot move backwards.');
    }

    let executed = 0;
    let next = this.tasks[0];

    while (next !== undefined && next.deadline <= time) {
      if (executed >= RPC_TEST_SCHEDULER_MAX_STEPS) {
        throw new Error(
          `RPC test scheduler exceeded ${RPC_TEST_SCHEDULER_MAX_STEPS} steps while advancing.`,
        );
      }

      await this.runNext();
      executed++;
      next = this.tasks[0];
    }

    this.currentTime = time;
    return executed;
  }

  /** Runs currently due tasks until quiescent or a finite step bound is exceeded. */
  async runUntilIdle(maxSteps = RPC_TEST_SCHEDULER_MAX_STEPS): Promise<number> {
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 0) {
      throw new RangeError('RPC test scheduler step limit must be a non-negative safe integer.');
    }

    let executed = 0;

    while (this.tasks[0]?.deadline === this.currentTime) {
      if (executed >= maxSteps) {
        let labels = this.tasks.map((task) => task.label ?? `task-${task.sequence}`).join(', ');
        throw new Error(
          `RPC test scheduler exceeded ${maxSteps} steps with pending work: ${labels}.`,
        );
      }

      await this.runNext();
      executed++;
    }

    return executed;
  }
}
