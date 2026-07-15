import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/telemetry';

/**
 * Factories used by telemetry implementations to run the shared compliance suite.
 */
export interface TelemetryComplianceTestSuite {
  /** Creates a fresh telemetry instance from contract construction options. */
  createTelemetry: (options?: Contract.TelemetryOptions) => Contract.Telemetry;
}

/**
 * Registers the shared behavioural tests every telemetry implementation must
 * satisfy.
 *
 * The suite asserts the public contract and implementation-agnostic charter
 * for telemetry clients: timer lifecycle, mark/measure, callback measurement,
 * value recording, namespace scoping, tag inheritance, buffered flush
 * semantics, freeze, dispose, and the autoStart hint.
 */
/** Collects emitted entries on the given telemetry instance for an event pattern. */
function collectEntries(telemetry: Contract.Telemetry, pattern: string): Contract.TelemetryEntry[] {
  const entries: Contract.TelemetryEntry[] = [];
  telemetry.on(pattern, (event) => {
    entries.push(event.details as Contract.TelemetryEntry);
  });
  return entries;
}

/** Collects all emitted entries using a glob pattern. */
function collectAllEntries(telemetry: Contract.Telemetry): Contract.TelemetryEntry[] {
  return collectEntries(telemetry, '*');
}

export function runTelemetryComplianceTests(factories: TelemetryComplianceTestSuite): void {
  const {createTelemetry} = factories;

  describe('telemetry compliance', () => {
    describe('timer metrics', () => {
      it('returns a handle from startTimer with the completion methods', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        const handle = telemetry.startTimer('operation');

        expect(typeof handle.stop).toBe('function');
        expect(typeof handle.fail).toBe('function');
        expect(typeof handle.cancel).toBe('function');
        expect(typeof handle.set).toBe('function');

        handle.cancel();
      });

      it('records a timer entry with status ok on stop', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.operation.recorded');

        const handle = telemetry.startTimer('operation');
        handle.stop();
        telemetry.flush();

        expect(entries).toHaveLength(1);
        const entry = entries[0] as Contract.TelemetryTimerEntry;
        expect(entry.metric).toBe('timer');
        expect(entry.name).toBe('operation');
        expect(entry.namespace).toBe('app.operation');
        expect(entry.status).toBe('ok');
        expect(entry.duration).toBeGreaterThanOrEqual(0);
      });

      it('records a timer entry with status error and reason on fail', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.operation.recorded');
        const reason = new Error('timeout');

        const handle = telemetry.startTimer('operation');
        handle.fail(reason);
        telemetry.flush();

        expect(entries).toHaveLength(1);
        const entry = entries[0] as Contract.TelemetryTimerEntry;
        expect(entry.status).toBe('error');
        expect(entry.reason).toBe(reason);
      });

      it('records nothing on cancel', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.operation.recorded');

        telemetry.startTimer('operation').cancel();
        telemetry.flush();

        expect(entries).toHaveLength(0);
      });

      it('is idempotent on double completion', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        const handle = telemetry.startTimer('operation');
        expect(handle.stop()).toBeDefined();
        expect(handle.stop()).toBeUndefined();
        expect(handle.fail()).toBeUndefined();
      });

      it('tracks overlapping timers with the same name independently', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.query.recorded');

        const timer1 = telemetry.startTimer('query');
        const timer2 = telemetry.startTimer('query');

        timer2.stop();
        timer1.stop();
        telemetry.flush();

        expect(entries).toHaveLength(2);
      });

      it('allows updating tags via set before completion', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.query.recorded');

        const handle = telemetry.startTimer('query');
        handle.set('tags', {method: 'GET'});
        handle.stop();
        telemetry.flush();

        expect(entries[0].tags).toEqual({method: 'GET'});
      });
    });

    describe('mark/measure', () => {
      it('creates a mark with qualified namespace and source', () => {
        const telemetry = createTelemetry({namespace: 'app', source: 'src'});

        const mark = telemetry.mark('start');

        expect(mark.name).toBe('start');
        expect(mark.namespace).toBe('app.start');
        expect(mark.source).toBe('src');

        mark.clear();
      });

      it('allows multiple measurements from the same mark', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        const mark = telemetry.mark('fork-point');
        const handle1 = mark.measure('handler-a');
        const handle2 = mark.measure('handler-b');

        handle1.stop();
        handle2.stop();
        telemetry.flush();

        expect(entries).toHaveLength(2);

        mark.clear();
      });

      it('throws when measuring from a cleared mark', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        const mark = telemetry.mark('start');
        mark.clear();

        expect(() => mark.measure('operation')).toThrow();
      });

      it('is a no-op on double clear of a mark', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        const mark = telemetry.mark('start');
        mark.clear();

        expect(() => mark.clear()).not.toThrow();
      });

      it('measures between two existing marks and returns the entry directly', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        const start = telemetry.mark('start');
        const end = telemetry.mark('end');

        const entry = telemetry.measure('duration', start, end);
        telemetry.flush();

        expect(entries).toHaveLength(1);
        expect(entry.metric).toBe('timer');
        expect(entry.name).toBe('duration');
        expect(entry.status).toBe('ok');

        start.clear();
        end.clear();
      });

      it('resolves marks by string name', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        telemetry.mark('start');
        telemetry.mark('end');

        telemetry.measure('duration', 'start', 'end');
        telemetry.flush();

        expect(entries).toHaveLength(1);
      });
    });

    describe('measureCallback', () => {
      it('returns the callback return value for a sync callback', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        const result = telemetry.measureCallback('compute', () => 42);

        expect(result).toBe(42);
      });

      it('records a success timer from a sync callback', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.compute.recorded');

        telemetry.measureCallback('compute', () => 'done');
        telemetry.flush();

        expect(entries).toHaveLength(1);
        expect((entries[0] as Contract.TelemetryTimerEntry).status).toBe('ok');
      });

      it('records a failure timer and re-throws from a sync callback', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.compute.recorded');
        const error = new Error('boom');

        expect(() => {
          telemetry.measureCallback('compute', () => {
            throw error;
          });
        }).toThrow(error);

        telemetry.flush();

        expect(entries).toHaveLength(1);
        const entry = entries[0] as Contract.TelemetryTimerEntry;
        expect(entry.status).toBe('error');
        expect(entry.reason).toBe(error);
      });

      it('records a success timer from an async callback', async () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.fetch.recorded');

        await telemetry.measureCallback('fetch', async () => 'data');
        telemetry.flush();

        expect(entries).toHaveLength(1);
        expect((entries[0] as Contract.TelemetryTimerEntry).status).toBe('ok');
      });
    });

    describe('value metrics', () => {
      it('records a value entry with status ok by default', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.snapshot.recorded');

        telemetry.record('snapshot', {cpu: 0.5});
        telemetry.flush();

        expect(entries).toHaveLength(1);
        const entry = entries[0] as Contract.TelemetryValueEntry;
        expect(entry.metric).toBe('value');
        expect(entry.namespace).toBe('app.snapshot');
        expect(entry.value).toEqual({cpu: 0.5});
        expect(entry.status).toBe('ok');
      });

      it('records with error status and reason via options', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectEntries(telemetry, 'telemetry:app.config.recorded');
        const reason = new Error('parse failed');

        telemetry.record('config', null, {status: 'error', reason});
        telemetry.flush();

        const entry = entries[0] as Contract.TelemetryValueEntry;
        expect(entry.status).toBe('error');
        expect(entry.reason).toBe(reason);
      });
    });

    describe('namespace scoping', () => {
      it('prefixes metric names with the namespace', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        telemetry.record('requests', 1);
        telemetry.flush();

        expect(entries[0].namespace).toBe('app.requests');
      });

      it('appends a namespace segment on fork', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        expect(telemetry.fork('http').namespace).toBe('app.http');
      });

      it('works with an empty root namespace', () => {
        const telemetry = createTelemetry();
        const entries = collectAllEntries(telemetry);

        telemetry.record('requests', 1);
        telemetry.flush();

        expect(entries[0].namespace).toBe('requests');
      });

      it('builds the full namespace path through a deep fork chain', () => {
        const root = createTelemetry({namespace: 'app'});

        expect(root.fork('http').fork('api').fork('v2').namespace).toBe('app.http.api.v2');
      });
    });

    describe('tag inheritance', () => {
      it('includes instance default tags on entries', () => {
        const telemetry = createTelemetry({namespace: 'app', tags: {env: 'prod'}});
        const entries = collectAllEntries(telemetry);

        telemetry.record('requests', 1);
        telemetry.flush();

        expect(entries[0].tags).toEqual({env: 'prod'});
      });

      it('inherits parent tags in a forked instance', () => {
        const parent = createTelemetry({namespace: 'app', tags: {env: 'prod'}});
        const child = parent.fork('http');
        const entries = collectEntries(child, 'telemetry:app.http.requests.recorded');

        child.record('requests', 1);
        child.flush();

        expect(entries[0].tags).toEqual({env: 'prod'});
      });

      it('merges fork tags with parent tags, fork overrides on collision', () => {
        const parent = createTelemetry({namespace: 'app', tags: {env: 'prod', version: '1'}});
        const child = parent.fork('http', {tags: {env: 'staging', region: 'us'}});
        const entries = collectEntries(child, 'telemetry:app.http.requests.recorded');

        child.record('requests', 1);
        child.flush();

        expect(entries[0].tags).toEqual({env: 'staging', version: '1', region: 'us'});
      });

      it('merges per-call tags with instance and parent tags', () => {
        const parent = createTelemetry({namespace: 'app', tags: {env: 'prod'}});
        const child = parent.fork('http', {tags: {layer: 'transport'}});
        const entries = collectEntries(child, 'telemetry:app.http.requests.recorded');

        child.record('requests', 1, {tags: {method: 'GET'}});
        child.flush();

        expect(entries[0].tags).toEqual({env: 'prod', layer: 'transport', method: 'GET'});
      });
    });

    describe('flush behavior', () => {
      it('emits events with the qualified namespace as event type', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const eventTypes: string[] = [];
        telemetry.on('*', (event) => {
          eventTypes.push(event.type);
        });

        telemetry.record('requests', 1);
        telemetry.record('memory', 512);
        telemetry.flush();

        expect(eventTypes).toContain('telemetry:app.requests.recorded');
        expect(eventTypes).toContain('telemetry:app.memory.recorded');
      });

      it('cascades flush depth-first (children flush before parent)', () => {
        const order: string[] = [];
        const parent = createTelemetry({namespace: 'parent'});
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

        const childIndex = order.findIndex(
          (e) => e === 'child:telemetry:parent.child.childMetric.recorded',
        );
        const parentIndex = order.findIndex(
          (e) => e === 'parent:telemetry:parent.parentMetric.recorded',
        );
        expect(childIndex).toBeLessThan(parentIndex);
      });

      it('bubbles events up through the fork tree', () => {
        const parent = createTelemetry({namespace: 'parent'});
        const child = parent.fork('child');
        const parentEntries: Contract.TelemetryEntry[] = [];

        parent.on('*', (event) => {
          parentEntries.push(event.details as Contract.TelemetryEntry);
        });

        child.record('requests', 1);
        child.flush();

        expect(parentEntries).toHaveLength(1);
        expect(parentEntries[0].namespace).toBe('parent.child.requests');
      });

      it('does not recurse when flush is called from within a flush listener', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        let flushCallCount = 0;

        telemetry.on('telemetry:app.trigger.recorded', () => {
          flushCallCount++;
          telemetry.flush();
        });

        telemetry.record('trigger', 1);
        telemetry.flush();

        expect(flushCallCount).toBe(1);
      });

      it('defers entries recorded during flush to the next cycle', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries: Contract.TelemetryEntry[] = [];

        telemetry.on('telemetry:app.trigger.recorded', () => {
          telemetry.record('deferred', 'queued-during-flush');
        });
        telemetry.on('*', (event) => {
          entries.push(event.details as Contract.TelemetryEntry);
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

      it('clears the queue after emitting', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        telemetry.record('requests', 1);
        telemetry.flush();

        expect(telemetry.size).toBe(0);
        expect(telemetry.isEmpty).toBe(true);
      });
    });

    describe('periodic flushing', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('enables periodic flushing and reflects state in isFlushing', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        expect(telemetry.isFlushing).toBe(false);

        telemetry.startFlushing({flushInterval: 1000});
        expect(telemetry.isFlushing).toBe(true);

        telemetry.record('requests', 1);
        vi.advanceTimersByTime(1000);

        expect(entries).toHaveLength(1);

        telemetry.stopFlushing();
        expect(telemetry.isFlushing).toBe(false);
      });

      it('is idempotent on double start and double stop', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        telemetry.startFlushing({flushInterval: 1000});
        expect(() => telemetry.startFlushing({flushInterval: 1000})).not.toThrow();

        telemetry.stopFlushing();
        expect(() => telemetry.stopFlushing()).not.toThrow();
        expect(telemetry.isFlushing).toBe(false);
      });
    });

    describe('freeze', () => {
      it('prevents recording new metrics after freeze', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        telemetry.freeze();

        expect(() => telemetry.startTimer('timer')).toThrow();
        expect(() => telemetry.mark('mark')).toThrow();
        expect(() => telemetry.record('data', 42)).toThrow();
      });

      it('allows flush after freeze', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        const entries = collectAllEntries(telemetry);

        telemetry.record('requests', 1);
        telemetry.freeze();

        expect(() => telemetry.flush()).not.toThrow();
        expect(entries).toHaveLength(1);
      });

      it('returns a readonly view', () => {
        const telemetry = createTelemetry({namespace: 'app', source: 'src'});
        const frozen = telemetry.freeze();

        expect(frozen.namespace).toBe('app');
        expect(frozen.source).toBe('src');
        expect(typeof frozen.isFlushing).toBe('boolean');
        expect(typeof frozen.autoStart).toBe('boolean');
      });
    });

    describe('dispose', () => {
      it('throws on subsequent use after dispose', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        telemetry.dispose();

        expect(() => telemetry.record('requests', 1)).toThrow();
        expect(() => telemetry.startTimer('timer')).toThrow();
        expect(() => telemetry.flush()).toThrow();
        expect(() => telemetry.fork('child')).toThrow();
      });

      it('throws on double dispose', () => {
        const telemetry = createTelemetry({namespace: 'app'});
        telemetry.dispose();

        expect(() => telemetry.dispose()).toThrow();
      });

      it('detaches children without disposing them', () => {
        const parent = createTelemetry({namespace: 'app', tags: {env: 'prod'}});
        const child = parent.fork('http');

        parent.dispose();

        const entries = collectAllEntries(child);
        child.record('requests', 1);
        child.flush();

        // Child survives independently but no longer inherits parent tags.
        expect(entries).toHaveLength(1);
        expect(entries[0].tags).toEqual({});
      });

      it('removes a disposed child from the parent flush cascade', () => {
        const parent = createTelemetry({namespace: 'app'});
        const child = parent.fork('http');
        const parentEntries: Contract.TelemetryEntry[] = [];

        child.dispose();
        parent.on('*', (event) => {
          parentEntries.push(event.details as Contract.TelemetryEntry);
        });

        parent.record('requests', 1);
        parent.flush();

        expect(parentEntries).toHaveLength(1);
        expect(parentEntries[0].namespace).toBe('app.requests');
      });
    });

    describe('source / owner', () => {
      it('stamps source on entries', () => {
        const source = {name: 'Service'};
        const telemetry = createTelemetry({namespace: 'app', source});
        const entries = collectAllEntries(telemetry);

        telemetry.record('requests', 1);
        telemetry.flush();

        expect(entries[0].source).toBe(source);
      });

      it('inherits source from parent in a forked instance', () => {
        const source = {name: 'Service'};
        const parent = createTelemetry({namespace: 'app', source});
        const child = parent.fork('http');
        const entries = collectEntries(child, 'telemetry:app.http.requests.recorded');

        child.record('requests', 1);
        child.flush();

        expect(entries[0].source).toBe(source);
      });

      it('overrides parent source with explicit fork source', () => {
        const parent = createTelemetry({namespace: 'app', source: {name: 'Parent'}});
        const child = parent.fork('http', {source: {name: 'Child'}});
        const entries = collectEntries(child, 'telemetry:app.http.requests.recorded');

        child.record('requests', 1);
        child.flush();

        expect(entries[0].source).toEqual({name: 'Child'});
      });
    });

    describe('queue size', () => {
      it('reflects the number of pending entries and clears after flush', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        expect(telemetry.size).toBe(0);
        expect(telemetry.isEmpty).toBe(true);

        telemetry.record('requests', 1);
        telemetry.record('memory', 512);
        expect(telemetry.size).toBe(2);
        expect(telemetry.isEmpty).toBe(false);

        telemetry.flush();
        expect(telemetry.size).toBe(0);
        expect(telemetry.isEmpty).toBe(true);
      });
    });

    describe('autoStart hint', () => {
      it('defaults to false and never auto-starts flushing', () => {
        const telemetry = createTelemetry({namespace: 'app'});

        expect(telemetry.autoStart).toBe(false);
        expect(telemetry.isFlushing).toBe(false);
      });

      it('is exposed as a hint but does not start flushing when true', () => {
        const telemetry = createTelemetry({autoStart: true});

        expect(telemetry.autoStart).toBe(true);
        expect(telemetry.isFlushing).toBe(false);
      });
    });
  });
}
