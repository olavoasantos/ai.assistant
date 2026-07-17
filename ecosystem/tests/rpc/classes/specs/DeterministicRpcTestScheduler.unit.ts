import {describe, expect, it} from 'vitest';
import {DeterministicRpcTestScheduler} from '../DeterministicRpcTestScheduler';

describe('DeterministicRpcTestScheduler', () => {
  it('starts idle at virtual time zero', () => {
    let scheduler = new DeterministicRpcTestScheduler();

    expect(scheduler.now).toBe(0);
    expect(scheduler.pending).toBe(0);
    expect(scheduler.tasks).toEqual([]);
  });

  it('runs tasks by deadline and insertion order', async () => {
    let scheduler = new DeterministicRpcTestScheduler();
    let order: string[] = [];
    scheduler.schedule(
      () => {
        order.push('later');
      },
      {delay: 10},
    );
    scheduler.schedule(
      () => {
        order.push('first');
      },
      {delay: 5},
    );
    scheduler.schedule(
      async () => {
        await Promise.resolve();
        order.push('second');
      },
      {delay: 5},
    );

    expect(await scheduler.runUntilIdle()).toBe(0);
    expect(await scheduler.advanceTo(10)).toBe(3);

    expect(order).toEqual(['first', 'second', 'later']);
    expect(scheduler.now).toBe(10);
    expect(scheduler.pending).toBe(0);
  });

  it('cancels pending tasks idempotently without running them', async () => {
    let scheduler = new DeterministicRpcTestScheduler();
    let calls = 0;
    let task = scheduler.schedule(() => {
      calls++;
    });

    expect(task.cancel()).toBe(true);
    expect(task.cancel()).toBe(false);
    expect(task.cancelled).toBe(true);
    expect(task.completed).toBe(false);
    expect(scheduler.pending).toBe(0);
    expect(scheduler.tasks).toEqual([]);
    expect(await scheduler.runNext()).toBe(false);
    expect(calls).toBe(0);
  });

  it('leaves future work pending until time advances explicitly', async () => {
    let scheduler = new DeterministicRpcTestScheduler();
    let order: string[] = [];
    scheduler.schedule(
      () => {
        order.push('outer');
        scheduler.schedule(
          () => {
            order.push('nested');
          },
          {delay: 2},
        );
      },
      {delay: 3},
    );
    scheduler.schedule(
      () => {
        order.push('future');
      },
      {delay: 10},
    );

    expect(await scheduler.advanceBy(5)).toBe(2);

    expect(order).toEqual(['outer', 'nested']);
    expect(scheduler.now).toBe(5);
    expect(scheduler.pending).toBe(1);

    expect(await scheduler.advanceTo(10)).toBe(1);
    expect(order).toEqual(['outer', 'nested', 'future']);
  });

  it('marks a throwing task completed while preserving its failure', async () => {
    let scheduler = new DeterministicRpcTestScheduler();
    let task = scheduler.schedule(() => {
      throw new Error('scheduled failure');
    });

    await expect(scheduler.runNext()).rejects.toThrow('scheduled failure');
    expect(task.completed).toBe(true);
    expect(task.cancel()).toBe(false);
    expect(scheduler.pending).toBe(0);
    expect(scheduler.tasks).toEqual([]);
  });

  it('rejects invalid time and step inputs', async () => {
    let scheduler = new DeterministicRpcTestScheduler();

    expect(() => scheduler.schedule(() => undefined, {delay: -1})).toThrow(RangeError);
    expect(() => scheduler.schedule(() => undefined, {delay: Number.POSITIVE_INFINITY})).toThrow(
      RangeError,
    );
    await expect(scheduler.advanceBy(-1)).rejects.toThrow(RangeError);
    await scheduler.advanceTo(2);
    await expect(scheduler.advanceTo(1)).rejects.toThrow(RangeError);
    await expect(scheduler.runUntilIdle(1.5)).rejects.toThrow(RangeError);
  });

  it('bounds runaway work and reports pending labels', async () => {
    let scheduler = new DeterministicRpcTestScheduler();
    let repeat = () => {
      scheduler.schedule(repeat, {label: 'recursive-delivery'});
    };
    scheduler.schedule(repeat, {label: 'recursive-delivery'});

    await expect(scheduler.runUntilIdle(3)).rejects.toThrow('pending work: recursive-delivery');
    expect(scheduler.pending).toBe(1);
  });
});
