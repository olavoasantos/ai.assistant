import type {
  TelemetryEntry,
  TelemetryTimerEntry,
  TelemetryValueEntry,
} from '@ai.assistant/contracts/telemetry';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Telemetry} from '../Telemetry';

/** Collects all emitted entries on the given telemetry instance for a specific event pattern. */
function collectEntries(telemetry: Telemetry, pattern: string): TelemetryEntry[] {
  const entries: TelemetryEntry[] = [];
  telemetry.on(pattern, (event) => {
    entries.push(event.details as TelemetryEntry);
  });
  return entries;
}

/** Collects all emitted entries on the given telemetry instance using a glob pattern. */
function collectAllEntries(telemetry: Telemetry): TelemetryEntry[] {
  return collectEntries(telemetry, '*');
}

describe('Telemetry', () => {
  describe('Timer metrics', () => {
    it('should return a handle from startTimer()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('dbQuery');

      expect(handle).toBeDefined();
      expect(typeof handle.stop).toBe('function');
      expect(typeof handle.fail).toBe('function');
      expect(typeof handle.cancel).toBe('function');
      expect(typeof handle.set).toBe('function');

      handle.cancel();
    });

    it('should record a timer entry with status ok on stop()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.dbQuery');

      const handle = telemetry.startTimer('dbQuery');
      handle.stop();
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.metric).toBe('timer');
      expect(entry.name).toBe('dbQuery');
      expect(entry.namespace).toBe('app.dbQuery');
      expect(entry.status).toBe('ok');
      expect(entry.duration).toBeGreaterThanOrEqual(0);
      expect(entry.startedAt).toBeGreaterThan(0);
    });

    it('should record a timer entry with status error on fail()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.dbQuery');
      const reason = new Error('connection timeout');

      const handle = telemetry.startTimer('dbQuery');
      handle.fail(reason);
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.metric).toBe('timer');
      expect(entry.status).toBe('error');
      expect(entry.reason).toBe(reason);
      expect(entry.duration).toBeGreaterThanOrEqual(0);
    });

    it('should record a timer entry without reason on fail() with no argument', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.dbQuery');

      const handle = telemetry.startTimer('dbQuery');
      handle.fail();
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.status).toBe('error');
      expect(entry.reason).toBeUndefined();
    });

    it('should record nothing when cancel() is called', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.dbQuery');

      const handle = telemetry.startTimer('dbQuery');
      handle.cancel();
      telemetry.flush();

      expect(entries).toHaveLength(0);
    });

    it('should be a no-op on double-stop', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('dbQuery');
      const entry = handle.stop();

      expect(entry).toBeDefined();
      expect(handle.stop()).toBeUndefined();
    });

    it('should be a no-op on double-fail', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('dbQuery');
      const entry = handle.fail();

      expect(entry).toBeDefined();
      expect(handle.fail()).toBeUndefined();
    });

    it('should be a no-op when stop() is called after cancel()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('dbQuery');
      handle.cancel();

      expect(handle.stop()).toBeUndefined();
    });

    it('should track overlapping timers with the same name independently', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.query');

      const timer1 = telemetry.startTimer('query');
      const timer2 = telemetry.startTimer('query');

      timer2.stop();
      timer1.stop();

      telemetry.flush();

      expect(entries).toHaveLength(2);
      expect((entries[0] as TelemetryTimerEntry).status).toBe('ok');
      expect((entries[1] as TelemetryTimerEntry).status).toBe('ok');
    });

    it('should return the timer entry from stop()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('query');
      const entry = handle.stop()!;

      expect(entry.metric).toBe('timer');
      expect(entry.name).toBe('query');
      expect(entry.status).toBe('ok');
    });

    it('should return the timer entry from fail()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const error = new Error('boom');

      const handle = telemetry.startTimer('query');
      const entry = handle.fail(error)!;

      expect(entry.metric).toBe('timer');
      expect(entry.status).toBe('error');
      expect(entry.reason).toBe(error);
    });

    it('should allow updating tags via set() before completion', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.query');

      const handle = telemetry.startTimer('query');
      handle.set('tags', {method: 'GET'});
      handle.stop();
      telemetry.flush();

      expect(entries[0].tags).toEqual({method: 'GET'});
    });
  });

  describe('Mark/Measure', () => {
    it('should create a mark with correct properties', () => {
      const telemetry = new Telemetry({namespace: 'app', source: 'test'});

      const mark = telemetry.mark('start');

      expect(mark.name).toBe('start');
      expect(mark.namespace).toBe('app.start');
      expect(mark.timestamp).toBeGreaterThan(0);
      expect(mark.source).toBe('test');

      mark.clear();
    });

    it('should create a timer handle from mark.measure()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.operation');

      const mark = telemetry.mark('start');
      const handle = mark.measure('operation');
      handle.stop();
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.metric).toBe('timer');
      expect(entry.name).toBe('operation');
      expect(entry.status).toBe('ok');
      expect(entry.duration).toBeGreaterThanOrEqual(0);

      mark.clear();
    });

    it('should allow multiple measurements from the same mark', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      const mark = telemetry.mark('fork-point');
      const handle1 = mark.measure('handler-a');
      const handle2 = mark.measure('handler-b');

      handle1.stop();
      handle2.stop();
      telemetry.flush();

      expect(entries).toHaveLength(2);
      expect((entries[0] as TelemetryTimerEntry).name).toBe('handler-a');
      expect((entries[1] as TelemetryTimerEntry).name).toBe('handler-b');

      mark.clear();
    });

    it('should throw when measuring from a cleared mark', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const mark = telemetry.mark('start');
      mark.clear();

      expect(() => mark.measure('operation')).toThrow(/cleared/);
    });

    it('should be a no-op on double clear of a mark', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const mark = telemetry.mark('start');
      mark.clear();

      expect(() => mark.clear()).not.toThrow();
    });

    it('should inherit mark tags in measurements', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.operation');

      const mark = telemetry.mark('start', {tags: {phase: 'init'}});
      const handle = mark.measure('operation');
      handle.stop();
      telemetry.flush();

      expect(entries[0].tags).toEqual({phase: 'init'});

      mark.clear();
    });

    it('should allow updating mark tags via set()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.operation');

      const mark = telemetry.mark('start');
      mark.set('tags', {phase: 'loaded'});
      const handle = mark.measure('operation');
      handle.stop();
      telemetry.flush();

      expect(entries[0].tags).toEqual({phase: 'loaded'});

      mark.clear();
    });

    it('should measure between two existing marks', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      const start = telemetry.mark('start');
      const end = telemetry.mark('end');

      const entry = telemetry.measure('duration', start, end);
      telemetry.flush();

      expect(entries).toHaveLength(1);
      expect(entry.metric).toBe('timer');
      expect(entry.name).toBe('duration');
      expect(entry.status).toBe('ok');
      expect(entry.duration).toBeGreaterThanOrEqual(0);

      start.clear();
      end.clear();
    });

    it('should resolve marks by string name', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.mark('start');
      telemetry.mark('end');

      telemetry.measure('duration', 'start', 'end');
      telemetry.flush();

      expect(entries).toHaveLength(1);
      expect((entries[0] as TelemetryTimerEntry).status).toBe('ok');
    });

    it('should throw when resolving an unknown mark name', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.mark('start');

      expect(() => telemetry.measure('duration', 'start', 'nonexistent')).toThrow(/not found/);
    });

    it('should return the timer entry directly from measure()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const start = telemetry.mark('start');
      const end = telemetry.mark('end');

      const entry = telemetry.measure('response-time', start, end);

      expect(entry.metric).toBe('timer');
      expect(entry.name).toBe('response-time');
      expect(entry.status).toBe('ok');
      expect(entry.duration).toBeGreaterThanOrEqual(0);

      start.clear();
      end.clear();
    });
  });

  describe('measureCallback', () => {
    it('should return the callback return value', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const result = telemetry.measureCallback('compute', () => 42);

      expect(result).toBe(42);
    });

    it('should record a success timer from a sync callback', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.compute');

      telemetry.measureCallback('compute', () => 'done');
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.metric).toBe('timer');
      expect(entry.status).toBe('ok');
    });

    it('should record a failure timer and re-throw from a sync callback', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.compute');
      const error = new Error('boom');

      expect(() => {
        telemetry.measureCallback('compute', () => {
          throw error;
        });
      }).toThrow(error);

      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.status).toBe('error');
      expect(entry.reason).toBe(error);
    });

    it('should return the resolved value from an async callback', async () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const result = await telemetry.measureCallback('fetch', async () => 'data');

      expect(result).toBe('data');
    });

    it('should record a success timer from an async callback', async () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.fetch');

      await telemetry.measureCallback('fetch', async () => 'data');
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.metric).toBe('timer');
      expect(entry.status).toBe('ok');
    });

    it('should record a failure timer and re-throw from an async callback', async () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.fetch');
      const error = new Error('network failure');

      await expect(
        telemetry.measureCallback('fetch', async () => {
          throw error;
        }),
      ).rejects.toThrow(error);

      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.status).toBe('error');
      expect(entry.reason).toBe(error);
    });
  });

  describe('Value metrics', () => {
    it('should record individual value entries', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.snapshot');

      telemetry.record('snapshot', {cpu: 0.5, mem: 1024});
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryValueEntry;
      expect(entry.metric).toBe('value');
      expect(entry.name).toBe('snapshot');
      expect(entry.namespace).toBe('app.snapshot');
      expect(entry.value).toEqual({cpu: 0.5, mem: 1024});
      expect(entry.status).toBe('ok');
    });

    it('should record any type of value', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.data');

      telemetry.record('data', 'string-value');
      telemetry.record('data', 42);
      telemetry.record('data', null);
      telemetry.record('data', [1, 2, 3]);
      telemetry.flush();

      expect(entries).toHaveLength(4);
      expect((entries[0] as TelemetryValueEntry).value).toBe('string-value');
      expect((entries[1] as TelemetryValueEntry).value).toBe(42);
      expect((entries[2] as TelemetryValueEntry).value).toBeNull();
      expect((entries[3] as TelemetryValueEntry).value).toEqual([1, 2, 3]);
    });

    it('should record with error status and reason', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectEntries(telemetry, 'telemetry:app.config');
      const err = new Error('parse failed');

      telemetry.record('config', null, {status: 'error', reason: err});
      telemetry.flush();

      expect(entries).toHaveLength(1);
      const entry = entries[0] as TelemetryValueEntry;
      expect(entry.status).toBe('error');
      expect(entry.reason).toBe(err);
    });
  });

  describe('Namespace scoping', () => {
    it('should prefix metric names with the namespace', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1);
      telemetry.flush();

      expect(entries[0].namespace).toBe('app.requests');
    });

    it('should append namespace segment on fork', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const child = telemetry.fork('http');

      expect(child.namespace).toBe('app.http');
    });

    it('should work correctly with an empty root namespace', () => {
      const telemetry = new Telemetry();
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1);
      telemetry.flush();

      expect(entries[0].name).toBe('requests');
      expect(entries[0].namespace).toBe('requests');
    });

    it('should build full namespace path through deep fork chain', () => {
      const root = new Telemetry({namespace: 'app'});
      const http = root.fork('http');
      const api = http.fork('api');
      const v2 = api.fork('v2');

      expect(v2.namespace).toBe('app.http.api.v2');
    });

    it('should fork from empty namespace without leading dot', () => {
      const root = new Telemetry();
      const child = root.fork('http');

      expect(child.namespace).toBe('http');
    });
  });

  describe('Tag inheritance', () => {
    it('should include instance default tags on entries', () => {
      const telemetry = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1);
      telemetry.flush();

      expect(entries[0].tags).toEqual({env: 'prod'});
    });

    it('should inherit parent tags in forked instance', () => {
      const parent = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const child = parent.fork('http');
      const entries = collectEntries(child, 'telemetry:app.http.requests');

      child.record('requests', 1);
      child.flush();

      expect(entries[0].tags).toEqual({env: 'prod'});
    });

    it('should merge fork tags with parent tags, fork overrides on collision', () => {
      const parent = new Telemetry({namespace: 'app', tags: {env: 'prod', version: '1'}});
      const child = parent.fork('http', {tags: {env: 'staging', region: 'us'}});
      const entries = collectEntries(child, 'telemetry:app.http.requests');

      child.record('requests', 1);
      child.flush();

      expect(entries[0].tags).toEqual({env: 'staging', version: '1', region: 'us'});
    });

    it('should merge per-call tags with instance and parent tags', () => {
      const parent = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const child = parent.fork('http', {tags: {layer: 'transport'}});
      const entries = collectEntries(child, 'telemetry:app.http.requests');

      child.record('requests', 1, {tags: {method: 'GET'}});
      child.flush();

      expect(entries[0].tags).toEqual({env: 'prod', layer: 'transport', method: 'GET'});
    });

    it('should accumulate tags through 3+ levels', () => {
      const root = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const mid = root.fork('session', {tags: {sid: '123'}});
      const leaf = mid.fork('agent', {tags: {agent: 'codegen'}});
      const entries = collectEntries(leaf, 'telemetry:app.session.agent.requests');

      leaf.record('requests', 1);
      leaf.flush();

      expect(entries[0].tags).toEqual({env: 'prod', sid: '123', agent: 'codegen'});
    });
  });

  describe('Flush behavior', () => {
    it('should emit events with the qualified namespace as event type', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const eventTypes: string[] = [];
      telemetry.on('*', (event) => {
        eventTypes.push(event.type);
      });

      telemetry.record('requests', 1);
      telemetry.record('memory', 512);
      telemetry.flush();

      expect(eventTypes).toContain('telemetry:app.requests');
      expect(eventTypes).toContain('telemetry:app.memory');
    });

    it('should cascade flush depth-first (children flush before parent)', () => {
      const order: string[] = [];
      const parent = new Telemetry({namespace: 'parent'});
      const child = parent.fork('child');

      parent.on('*', (event) => {
        order.push(`parent:${event.type}`);
      });
      child.on('*', (event) => {
        order.push(`child:${event.type}`);
      });

      child.record('childMetric', 1);
      parent.record('parentMetric', 1);
      parent.flush();

      const childIndex = order.findIndex((e) => e === 'child:telemetry:parent.child.childMetric');
      const parentIndex = order.findIndex((e) => e === 'parent:telemetry:parent.parentMetric');
      expect(childIndex).toBeLessThan(parentIndex);
    });

    it('should bubble events up through the event tree', () => {
      const parent = new Telemetry({namespace: 'parent'});
      const child = parent.fork('child');
      const parentEntries: TelemetryEntry[] = [];

      parent.on('*', (event) => {
        parentEntries.push(event.details as TelemetryEntry);
      });

      child.record('requests', 1);
      child.flush();

      expect(parentEntries).toHaveLength(1);
      expect(parentEntries[0].namespace).toBe('parent.child.requests');
    });

    it('should not recurse when flush() is called from within a flush listener', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      let flushCallCount = 0;

      telemetry.on('telemetry:app.trigger', () => {
        flushCallCount++;
        telemetry.flush();
      });

      telemetry.record('trigger', 1);
      telemetry.flush();

      expect(flushCallCount).toBe(1);
    });

    it('should clear queue after emitting', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.record('requests', 1);
      telemetry.flush();

      expect(telemetry.size).toBe(0);
      expect(telemetry.isEmpty).toBe(true);
    });

    it('should do nothing on flush when empty', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.flush();

      expect(entries).toHaveLength(0);
    });

    it('should defer entries recorded during flush to the next cycle', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries: TelemetryEntry[] = [];

      telemetry.on('telemetry:app.trigger', () => {
        telemetry.record('deferred', 'queued-during-flush');
      });
      telemetry.on('*', (event) => {
        entries.push(event.details as TelemetryEntry);
      });

      telemetry.record('trigger', 1);
      telemetry.flush();

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('trigger');

      entries.length = 0;
      telemetry.flush();

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('deferred');
    });
  });

  describe('startFlushing / stopFlushing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should enable periodic flushing', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.startFlushing({flushInterval: 1000});
      telemetry.record('requests', 1);
      vi.advanceTimersByTime(1000);

      expect(entries).toHaveLength(1);

      telemetry.stopFlushing();
    });

    it('should stop periodic flushing on stopFlushing()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.startFlushing({flushInterval: 1000});
      telemetry.record('requests', 1);
      vi.advanceTimersByTime(1000);

      telemetry.stopFlushing();

      telemetry.record('requests', 2);
      vi.advanceTimersByTime(5000);

      expect(entries).toHaveLength(1);
    });

    it('should reflect current state in isFlushing', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      expect(telemetry.isFlushing).toBe(false);

      telemetry.startFlushing({flushInterval: 1000});
      expect(telemetry.isFlushing).toBe(true);

      telemetry.stopFlushing();
      expect(telemetry.isFlushing).toBe(false);
    });

    it('should be idempotent on double startFlushing()', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.startFlushing({flushInterval: 1000});
      telemetry.startFlushing({flushInterval: 1000});

      telemetry.record('requests', 1);
      vi.advanceTimersByTime(1000);

      expect(entries).toHaveLength(1);

      telemetry.stopFlushing();
    });

    it('should be idempotent on double stopFlushing()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.startFlushing({flushInterval: 1000});
      telemetry.stopFlushing();

      expect(() => telemetry.stopFlushing()).not.toThrow();
      expect(telemetry.isFlushing).toBe(false);
    });

    it('should use custom flushInterval from startFlushing() options', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.startFlushing({flushInterval: 500});
      telemetry.record('requests', 1);
      vi.advanceTimersByTime(500);

      expect(entries).toHaveLength(1);

      telemetry.stopFlushing();
    });

    it('should use constructor flushInterval when startFlushing has no override', () => {
      const telemetry = new Telemetry({namespace: 'app', flushInterval: 2000});
      const entries = collectAllEntries(telemetry);

      telemetry.startFlushing();
      telemetry.record('requests', 1);
      vi.advanceTimersByTime(1999);
      expect(entries).toHaveLength(0);

      vi.advanceTimersByTime(1);
      expect(entries).toHaveLength(1);

      telemetry.stopFlushing();
    });
  });

  describe('Freeze', () => {
    it('should prevent recording new metrics after freeze', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      telemetry.freeze();

      expect(() => telemetry.startTimer('timer')).toThrow(/frozen/);
      expect(() => telemetry.mark('mark')).toThrow(/frozen/);
      expect(() => telemetry.record('data', 42)).toThrow(/frozen/);
    });

    it('should allow flush() after freeze', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1);
      telemetry.freeze();

      expect(() => telemetry.flush()).not.toThrow();
      expect(entries).toHaveLength(1);
    });

    it('should return a ReadonlyTelemetry view', () => {
      const telemetry = new Telemetry({namespace: 'app', source: 'test'});
      const frozen = telemetry.freeze();

      expect(frozen.namespace).toBe('app');
      expect(frozen.source).toBe('test');
      expect(frozen.size).toBe(0);
      expect(frozen.isEmpty).toBe(true);
      expect(typeof frozen.isFlushing).toBe('boolean');
      expect(typeof frozen.autoStart).toBe('boolean');
    });
  });

  describe('Dispose', () => {
    it('should clear all state on dispose', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.record('requests', 1);
      telemetry.dispose();

      expect(() => telemetry.size).toThrow(/disposed/);
    });

    it('should throw on subsequent use after dispose', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      telemetry.dispose();

      expect(() => telemetry.record('requests', 1)).toThrow(/disposed/);
      expect(() => telemetry.startTimer('timer')).toThrow(/disposed/);
      expect(() => telemetry.flush()).toThrow(/disposed/);
      expect(() => telemetry.fork('child')).toThrow(/disposed/);
    });

    it('should remove disposed child from parent children set', () => {
      const parent = new Telemetry({namespace: 'app'});
      const child = parent.fork('http');
      const parentEntries: TelemetryEntry[] = [];

      child.dispose();

      parent.on('*', (event) => {
        parentEntries.push(event.details as TelemetryEntry);
      });

      parent.record('requests', 1);
      parent.flush();

      expect(parentEntries).toHaveLength(1);
      expect(parentEntries[0].namespace).toBe('app.requests');
    });

    it('should cancel pending timers on dispose', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.startTimer('query1');
      telemetry.startTimer('query2');

      expect(() => telemetry.dispose()).not.toThrow();
    });

    it('should cancel pending marks on dispose', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.mark('start');
      telemetry.mark('middle');

      expect(() => telemetry.dispose()).not.toThrow();
    });

    it('should stop flushing if active on dispose', () => {
      vi.useFakeTimers();
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.startFlushing({flushInterval: 1000});
      expect(telemetry.isFlushing).toBe(true);

      telemetry.dispose();

      vi.advanceTimersByTime(5000);
      vi.useRealTimers();
    });

    it('should throw on double dispose', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      telemetry.dispose();

      expect(() => telemetry.dispose()).toThrow(/disposed/);
    });

    it('should detach children without disposing them', () => {
      const parent = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const child = parent.fork('http');

      parent.dispose();

      child.record('requests', 1);
      const entries = collectAllEntries(child);
      child.flush();

      expect(entries).toHaveLength(1);
      // Child no longer inherits parent tags
      expect(entries[0].tags).toEqual({});
    });
  });

  describe('Source / owner', () => {
    it('should stamp source on entries', () => {
      const source = {name: 'MyService'};
      const telemetry = new Telemetry({namespace: 'app', source});
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1);
      telemetry.flush();

      expect(entries[0].source).toBe(source);
    });

    it('should inherit source from parent in forked instance', () => {
      const source = {name: 'MyService'};
      const parent = new Telemetry({namespace: 'app', source});
      const child = parent.fork('http');
      const entries = collectEntries(child, 'telemetry:app.http.requests');

      child.record('requests', 1);
      child.flush();

      expect(entries[0].source).toBe(source);
    });

    it('should override parent source with explicit fork source', () => {
      const parentSource = {name: 'Parent'};
      const childSource = {name: 'Child'};
      const parent = new Telemetry({namespace: 'app', source: parentSource});
      const child = parent.fork('http', {source: childSource});
      const entries = collectEntries(child, 'telemetry:app.http.requests');

      child.record('requests', 1);
      child.flush();

      expect(entries[0].source).toBe(childSource);
    });
  });

  describe('Size and isEmpty', () => {
    it('should reflect number of pending entries', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      expect(telemetry.size).toBe(0);

      telemetry.record('requests', 1);
      expect(telemetry.size).toBe(1);

      telemetry.record('memory', 512);
      expect(telemetry.size).toBe(2);
    });

    it('should count timer entries in queue', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const handle = telemetry.startTimer('query');
      expect(telemetry.size).toBe(0); // Not queued yet

      handle.stop();
      expect(telemetry.size).toBe(1); // Now queued
    });

    it('should be true for isEmpty when no pending entries', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      expect(telemetry.isEmpty).toBe(true);

      telemetry.record('requests', 1);
      expect(telemetry.isEmpty).toBe(false);
    });

    it('should update size after flush', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.record('requests', 1);
      telemetry.record('memory', 512);
      expect(telemetry.size).toBe(2);

      telemetry.flush();
      expect(telemetry.size).toBe(0);
      expect(telemetry.isEmpty).toBe(true);
    });
  });

  describe('Entry timestamps and common fields', () => {
    it('should include a wall-clock timestamp on all entries', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      const before = Date.now();
      telemetry.record('requests', 1);
      const after = Date.now();
      telemetry.flush();

      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should include a high-res startedAt on timer entries', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      const handle = telemetry.startTimer('query');
      handle.stop();
      telemetry.flush();

      const entry = entries[0] as TelemetryTimerEntry;
      expect(entry.startedAt).toBeGreaterThan(0);
      expect(typeof entry.startedAt).toBe('number');
    });

    it('should include tags on entries with per-call tags', () => {
      const telemetry = new Telemetry({namespace: 'app', tags: {env: 'prod'}});
      const entries = collectAllEntries(telemetry);

      telemetry.record('requests', 1, {tags: {method: 'GET'}});
      telemetry.flush();

      expect(entries[0].tags).toEqual({env: 'prod', method: 'GET'});
    });
  });

  describe('autoStart flag', () => {
    it('should NOT auto-flush when autoStart is true', () => {
      const telemetry = new Telemetry({autoStart: true, flushInterval: 100});

      expect(telemetry.autoStart).toBe(true);
      expect(telemetry.isFlushing).toBe(false);
    });

    it('should default autoStart to false', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      expect(telemetry.autoStart).toBe(false);
    });
  });

  describe('addChild/removeChild synchronization', () => {
    it('should include manually added telemetry child in flush cascade', () => {
      const parent = new Telemetry({namespace: 'parent'});
      const child = new Telemetry({namespace: 'child'});
      const parentEntries: TelemetryEntry[] = [];

      parent.addChild(child);
      parent.on('*', (event) => {
        parentEntries.push(event.details as TelemetryEntry);
      });

      child.record('requests', 1);
      parent.flush();

      expect(parentEntries).toHaveLength(1);
      expect(parentEntries[0].namespace).toBe('child.requests');
    });

    it('should exclude manually removed telemetry child from flush cascade', () => {
      const parent = new Telemetry({namespace: 'parent'});
      const child = parent.fork('child');
      const parentEntries: TelemetryEntry[] = [];

      parent.removeChild(child);
      parent.on('*', (event) => {
        parentEntries.push(event.details as TelemetryEntry);
      });

      child.record('requests', 1);
      parent.flush();

      expect(parentEntries).toHaveLength(0);
    });

    it('should stop events from bubbling after removeChild', () => {
      const parent = new Telemetry({namespace: 'parent'});
      const child = parent.fork('child');
      const parentEntries: TelemetryEntry[] = [];

      parent.removeChild(child);
      parent.on('*', (event) => {
        parentEntries.push(event.details as TelemetryEntry);
      });

      child.record('requests', 1);
      child.flush();

      expect(parentEntries).toHaveLength(0);
    });

    it('should inherit parent tags for manually added telemetry child', () => {
      const parent = new Telemetry({namespace: 'parent', tags: {env: 'prod'}});
      const child = new Telemetry({namespace: 'child'});

      parent.addChild(child);

      const entries = collectEntries(child, 'telemetry:child.requests');
      child.record('requests', 1);
      child.flush();

      expect(entries).toHaveLength(1);
      expect(entries[0].tags).toEqual({env: 'prod'});
    });

    it('should stop inheriting ancestor tags on grandchild after mid-chain removeChild', () => {
      const root = new Telemetry({namespace: 'root', tags: {env: 'prod'}});
      const mid = root.fork('mid');
      const leaf = mid.fork('leaf');

      // Prime the grandchild — read its resolved tags
      const beforeEntries = collectEntries(leaf, 'telemetry:root.mid.leaf.before');
      leaf.record('before', 1);
      leaf.flush();
      expect(beforeEntries[0].tags).toEqual({env: 'prod'});

      // Remove mid from root
      root.removeChild(mid);

      // Grandchild should no longer inherit root tags
      const afterEntries = collectEntries(leaf, 'telemetry:root.mid.leaf.after');
      leaf.record('after', 1);
      leaf.flush();
      expect(afterEntries[0].tags).toEqual({});
    });

    it('should stop inheriting ancestor tags on grandchild after ancestor dispose', () => {
      const root = new Telemetry({namespace: 'root', tags: {env: 'prod'}});
      const mid = root.fork('mid', {tags: {layer: 'mid'}});
      const leaf = mid.fork('leaf');

      // Prime the grandchild
      const beforeEntries = collectEntries(leaf, 'telemetry:root.mid.leaf.before');
      leaf.record('before', 1);
      leaf.flush();
      expect(beforeEntries[0].tags).toEqual({env: 'prod', layer: 'mid'});

      // Dispose root — detaches mid, mid loses root tags
      root.dispose();

      // Grandchild should only have mid's own tags
      const afterEntries = collectEntries(leaf, 'telemetry:root.mid.leaf.after');
      leaf.record('after', 1);
      leaf.flush();
      expect(afterEntries[0].tags).toEqual({layer: 'mid'});
    });

    it('should propagate tag changes through deep fork chains after reparenting', () => {
      const root = new Telemetry({namespace: 'root', tags: {env: 'prod'}});
      const a = root.fork('a');
      const b = a.fork('b');
      const c = b.fork('c');
      const d = c.fork('d');

      // Prime all descendants
      const entries = collectEntries(d, 'telemetry:root.a.b.c.d.check');
      d.record('check', 1);
      d.flush();
      expect(entries[0].tags).toEqual({env: 'prod'});

      // Remove a from root — all descendants should lose root tags
      root.removeChild(a);

      const afterEntries = collectEntries(d, 'telemetry:root.a.b.c.d.after');
      d.record('after', 1);
      d.flush();
      expect(afterEntries[0].tags).toEqual({});
    });
  });

  describe('Mark reusability and cancellation edge cases', () => {
    it('should not destroy shared mark when canceling one measurement handle', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const entries = collectAllEntries(telemetry);

      const mark = telemetry.mark('fork-point');
      const handle1 = mark.measure('handler-a');
      const handle2 = mark.measure('handler-b');

      // Cancel one — the shared mark should survive
      handle1.cancel();

      // The other should still complete successfully
      handle2.stop();
      telemetry.flush();

      expect(entries).toHaveLength(1);
      expect((entries[0] as TelemetryTimerEntry).name).toBe('handler-b');
      expect((entries[0] as TelemetryTimerEntry).status).toBe('ok');

      mark.clear();
    });

    it('should throw when using a cleared mark object in measure()', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const start = telemetry.mark('start');
      const end = telemetry.mark('end');
      start.clear();

      expect(() => telemetry.measure('duration', start, end)).toThrow(/cleared/);

      end.clear();
    });

    it('should handle duplicate mark names correctly on cancel', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      const mark1 = telemetry.mark('point');
      const mark2 = telemetry.mark('point'); // overwrites in map

      // Canceling the older one should not remove the newer from lookup
      mark1.clear();

      // The newer mark should still be resolvable by name
      const handle = mark2.measure('op');
      handle.stop();

      mark2.clear();
    });
  });

  describe('Flush error resilience', () => {
    it('should emit all entries even when a listener throws', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const received: string[] = [];

      telemetry.on('telemetry:app.first', () => {
        received.push('first');
        throw new Error('listener failure');
      });
      telemetry.on('telemetry:app.second', () => {
        received.push('second');
      });

      telemetry.record('first', 1);
      telemetry.record('second', 2);

      expect(() => telemetry.flush()).toThrow(/listener failure/);

      // Both entries were emitted despite the first throwing
      expect(received).toEqual(['first', 'second']);
    });

    it('should not lose entries when flush throws', () => {
      const telemetry = new Telemetry({namespace: 'app'});

      telemetry.on('telemetry:app.boom', () => {
        throw new Error('boom');
      });

      telemetry.record('boom', 1);
      telemetry.record('safe', 2);

      expect(() => telemetry.flush()).toThrow();

      // Queue should be empty — entries were processed
      expect(telemetry.size).toBe(0);
    });
  });

  describe('Freeze edge cases', () => {
    it('should throw on measure() after freeze', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      const start = telemetry.mark('start');
      const end = telemetry.mark('end');
      telemetry.freeze();

      expect(() => telemetry.measure('duration', start, end)).toThrow(/frozen/);

      start.clear();
      end.clear();
    });

    it('should throw on measureCallback() after freeze', () => {
      const telemetry = new Telemetry({namespace: 'app'});
      telemetry.freeze();

      expect(() => telemetry.measureCallback('op', () => 1)).toThrow(/frozen/);
    });
  });
});
