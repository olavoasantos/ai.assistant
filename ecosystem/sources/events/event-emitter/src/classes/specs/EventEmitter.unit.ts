import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import {Event} from '../Event';
import {EventEmitter} from '../EventEmitter';

interface TestEvents {
  'session:labeled': string | undefined;
  'tool:ended': {success: boolean; toolId: string};
  'tool:started': {toolId: string};
  'turn:ended': undefined;
  'turn:started': {turnId: string};
}

describe('EventEmitter', () => {
  it('should emit to exact listeners with typed details', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('tool:started', (event) => {
      expectTypeOf(event.type).toEqualTypeOf<'tool:started'>();
      expectTypeOf(event.details).toEqualTypeOf<{toolId: string}>();
      listener(event.details.toolId);
    });

    const event = emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).toHaveBeenCalledWith('tool-1');
    expect(event.type).toBe('tool:started');
    expect(event.details).toEqual({toolId: 'tool-1'});
  });

  it('should allow omitting details for events whose payload type is undefined', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('turn:ended', (event) => {
      expectTypeOf(event.details).toEqualTypeOf<undefined>();
      listener(event.details);
    });

    const event = emitter.emit('turn:ended');

    expect(listener).toHaveBeenCalledWith(undefined);
    expect(event.details).toBeUndefined();
  });

  it('should require details for payload-bearing events at compile time', () => {
    const emitter = new EventEmitter<TestEvents>();

    // @ts-expect-error payload-bearing events require explicit details
    const invalidEmit = () => emitter.emit('tool:started');

    expectTypeOf(invalidEmit).toEqualTypeOf<() => Event<'tool:started', {toolId: string}>>();
  });

  it('should still require options when the payload union includes undefined', () => {
    const emitter = new EventEmitter<TestEvents>();

    // @ts-expect-error union payloads still require explicit emit options
    const invalidEmit = () => emitter.emit('session:labeled');

    expectTypeOf(invalidEmit).toEqualTypeOf<() => Event<'session:labeled', string | undefined>>();
  });

  it('should allow undefined details when explicitly provided for union payloads', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('session:labeled', (event) => {
      expectTypeOf(event.details).toEqualTypeOf<string | undefined>();
      listener(event.details);
    });

    const event = emitter.emit('session:labeled', {details: undefined});

    expect(listener).toHaveBeenCalledWith(undefined);
    expect(event.details).toBeUndefined();
  });

  it('should infer union event types for glob listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('tool:*', (event) => {
      expectTypeOf(event.type).toEqualTypeOf<'tool:started' | 'tool:ended'>();
      expectTypeOf(event.details).toEqualTypeOf<
        {toolId: string} | {success: boolean; toolId: string}
      >();
      listener(event.type);
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    emitter.emit('tool:ended', {details: {success: true, toolId: 'tool-1'}});

    expect(listener).toHaveBeenNthCalledWith(1, 'tool:started');
    expect(listener).toHaveBeenNthCalledWith(2, 'tool:ended');
  });

  it('should ignore duplicate registrations for the same pattern and listener', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('tool:started', listener);
    emitter.on('tool:started', listener);
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should keep the first registration mode for duplicate pattern and listener pairs', () => {
    const emitter = new EventEmitter<TestEvents>();
    const persistentListener = vi.fn();
    const oneShotListener = vi.fn();

    emitter.on('tool:started', persistentListener);
    emitter.once('tool:started', persistentListener);
    emitter.once('tool:ended', oneShotListener);
    emitter.on('tool:ended', oneShotListener);

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    emitter.emit('tool:ended', {details: {success: true, toolId: 'tool-1'}});
    emitter.emit('tool:ended', {details: {success: true, toolId: 'tool-1'}});

    expect(persistentListener).toHaveBeenCalledTimes(2);
    expect(oneShotListener).toHaveBeenCalledTimes(1);
  });

  it('should preserve listener order across exact and glob registrations', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on('tool:started', () => {
      calls.push('exact:first');
    });
    emitter.on('tool:*', () => {
      calls.push('glob:second');
    });
    emitter.on('tool:started', () => {
      calls.push('exact:third');
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['exact:first', 'glob:second', 'exact:third']);
  });

  it('should bubble events through parent emitters', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    root.on('tool:started', () => {
      calls.push('root');
    });
    child.on('tool:started', () => {
      calls.push('child');
    });

    const event = child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['child', 'root']);
    expect(event.origin).toBe(child);
    expect(event.currentEmitter).toBeNull();
    expect(event.propagationPath()).toEqual([child, root]);
  });

  it('should bubble through multi-level parent chains', () => {
    const root = new EventEmitter<TestEvents>();
    const middle = new EventEmitter<TestEvents>();
    const leaf = new EventEmitter<TestEvents>();
    root.addChild(middle);
    middle.addChild(leaf);
    const calls: string[] = [];

    root.on('tool:started', () => {
      calls.push('root');
    });
    middle.on('tool:started', () => {
      calls.push('middle');
    });
    leaf.on('tool:started', () => {
      calls.push('leaf');
    });

    const event = leaf.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['leaf', 'middle', 'root']);
    expect(event.origin).toBe(leaf);
    expect(event.propagationPath()).toEqual([leaf, middle, root]);
  });

  it('should not bubble when bubbles is false', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const rootListener = vi.fn();
    const childListener = vi.fn();

    root.on('tool:started', rootListener);
    child.on('tool:started', childListener);

    const event = child.emit('tool:started', {
      bubbles: false,
      details: {toolId: 'tool-1'},
    });

    expect(childListener).toHaveBeenCalledTimes(1);
    expect(rootListener).not.toHaveBeenCalled();
    expect(event.propagationPath()).toEqual([child]);
  });

  it('should stop propagation to ancestor emitters without skipping current listeners', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    child.on('tool:started', (event) => {
      calls.push('first');
      event.stopPropagation();
    });
    child.on('tool:started', () => {
      calls.push('second');
    });
    root.on('tool:started', () => {
      calls.push('root');
    });

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['first', 'second']);
  });

  it('should stop remaining listeners on the current emitter with stopImmediatePropagation', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    child.on('tool:started', (event) => {
      calls.push('first');
      event.stopImmediatePropagation();
    });
    child.on('tool:started', () => {
      calls.push('second');
    });
    root.on('tool:started', () => {
      calls.push('root');
    });

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['first']);
  });

  it('should remove one-shot listeners before their first invocation', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.once('tool:started', () => {
      listener();
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should remove listeners through the cleanup function returned by on', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    const cleanup = emitter.on('tool:started', listener);

    cleanup();
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should remove listeners through off', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('tool:started', listener);
    emitter.off('tool:started', listener);
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should ignore off calls for unregistered listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const registeredListener = vi.fn();
    const unregisteredListener = vi.fn();

    emitter.on('tool:started', registeredListener);

    expect(() => {
      emitter.off('tool:started', unregisteredListener);
    }).not.toThrow();

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(registeredListener).toHaveBeenCalledTimes(1);
    expect(unregisteredListener).not.toHaveBeenCalled();
  });

  it('should return a detach function from addChild', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    const rootListener = vi.fn();
    const detach = root.addChild(child);

    root.on('tool:started', rootListener);
    detach();
    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(rootListener).not.toHaveBeenCalled();
  });

  it('should remove children explicitly', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const rootListener = vi.fn();

    root.on('tool:started', rootListener);
    root.removeChild(child);
    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(rootListener).not.toHaveBeenCalled();
  });

  it('should ignore removeChild calls for emitters that are not children', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    const unrelated = new EventEmitter<TestEvents>();
    root.addChild(child);
    const rootListener = vi.fn();

    root.on('tool:started', rootListener);

    expect(() => {
      root.removeChild(unrelated);
    }).not.toThrow();

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(rootListener).toHaveBeenCalledTimes(1);
  });

  it('should automatically detach from old parent when reparenting', () => {
    const firstParent = new EventEmitter<TestEvents>();
    const secondParent = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    firstParent.addChild(child);

    secondParent.addChild(child);

    // Child events should bubble to the new parent, not the old one
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    firstParent.on('turn:ended', firstListener);
    secondParent.on('turn:ended', secondListener);
    child.emit('turn:ended');

    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledOnce();
  });

  it('should throw when adding an emitter as its own child', () => {
    const emitter = new EventEmitter<TestEvents>();

    expect(() => {
      emitter.addChild(emitter);
    }).toThrowError('An event emitter cannot be added as its own child.');
  });

  it('should throw when adding a child would create a cycle', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);

    expect(() => {
      child.addChild(root);
    }).toThrowError('Adding this child would create an event emitter cycle.');
  });

  it('should throw when emitting a non-runtime event implementation', () => {
    const emitter = new EventEmitter<TestEvents>();

    expect(() => {
      emitter.emit({
        bubbles: true,
        currentEmitter: null,
        details: {toolId: 'tool-1'},
        immediatePropagationStopped: false,
        origin: null,
        propagationPath: () => [],
        propagationStopped: false,
        stopImmediatePropagation: () => undefined,
        stopPropagation: () => undefined,
        type: 'tool:started',
      });
    }).toThrowError(
      'emit(event) requires an Event instance created by @ai.assistant/event-emitter.',
    );
  });

  it('should throw when re-emitting the same event instance', () => {
    const emitter = new EventEmitter<TestEvents>();
    const event = new Event<'tool:started', {toolId: string}>('tool:started', {
      details: {toolId: 'tool-1'},
    });

    emitter.emit(event);

    expect(() => {
      emitter.emit(event);
    }).toThrowError('Cannot re-emit an event that is already in use.');
  });

  it('should reset emit state when a listener throws', () => {
    const emitter = new EventEmitter<TestEvents>();
    const event = new Event<'tool:started', {toolId: string}>('tool:started', {
      details: {toolId: 'tool-1'},
    });
    const cause = new Error('boom');

    emitter.on('tool:started', () => {
      throw cause;
    });

    expect(() => {
      emitter.emit(event);
    }).toThrow(cause);
    expect(event.origin).toBe(emitter);
    expect(event.currentEmitter).toBeNull();
    expect(event.propagationPath()).toEqual([emitter]);

    expect(() => {
      emitter.emit(event);
    }).toThrowError('Cannot re-emit an event that is already in use.');
  });

  it('should return the emitted event instance', () => {
    const emitter = new EventEmitter<TestEvents>();
    const event = new Event<'tool:started', {toolId: string}>('tool:started', {
      details: {toolId: 'tool-1'},
    });

    expect(emitter.emit(event)).toBe(event);
  });

  it('should reject non-runtime child emitters', () => {
    const emitter = new EventEmitter<TestEvents>();

    expect(() => {
      emitter.addChild({
        addChild: () => () => undefined,
        emit: () => new Event('tool:started'),
        off: () => undefined,
        on: () => () => undefined,
        once: () => () => undefined,
        removeChild: () => undefined,
      });
    }).toThrowError(
      'Child emitters must be EventEmitter instances created by @ai.assistant/event-emitter.',
    );
  });

  it('should continue dispatching remaining listeners when one throws', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on('tool:started', () => {
      calls.push('first');
      throw new Error('boom');
    });
    emitter.on('tool:started', () => {
      calls.push('second');
    });

    expect(() => {
      emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    }).toThrow('boom');

    expect(calls).toEqual(['first', 'second']);
  });

  it('should continue bubbling when a listener on a child throws', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    child.on('tool:started', () => {
      calls.push('child');
      throw new Error('boom');
    });
    root.on('tool:started', () => {
      calls.push('root');
    });

    expect(() => {
      child.emit('tool:started', {details: {toolId: 'tool-1'}});
    }).toThrow('boom');

    expect(calls).toEqual(['child', 'root']);
  });

  it('should re-throw the first error when multiple listeners throw', () => {
    const emitter = new EventEmitter<TestEvents>();
    const firstError = new Error('first');
    const secondError = new Error('second');

    emitter.on('tool:started', () => {
      throw firstError;
    });
    emitter.on('tool:started', () => {
      throw secondError;
    });

    expect(() => {
      emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    }).toThrow(firstError);
  });

  it('should still remove a once listener that throws', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn(() => {
      throw new Error('boom');
    });

    emitter.once('tool:started', listener);

    expect(() => {
      emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    }).toThrow('boom');

    expect(() => {
      emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    }).not.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should still fire listeners removed by an earlier listener during dispatch', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];
    const secondListener = vi.fn(() => {
      calls.push('second');
    });

    emitter.on('tool:started', () => {
      calls.push('first');
      emitter.off('tool:started', secondListener);
    });
    emitter.on('tool:started', secondListener);

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['first', 'second']);
  });

  it('should not fire listeners added during dispatch', () => {
    const emitter = new EventEmitter<TestEvents>();
    const lateListener = vi.fn();

    emitter.on('tool:started', () => {
      emitter.on('tool:started', lateListener);
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(lateListener).not.toHaveBeenCalled();
  });

  it('should support emitting a different event from inside a listener', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on('tool:started', () => {
      calls.push('tool:started:before');
      emitter.emit('turn:ended');
      calls.push('tool:started:after');
    });
    emitter.on('turn:ended', () => {
      calls.push('turn:ended');
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['tool:started:before', 'turn:ended', 'tool:started:after']);
  });

  it('should throw when re-emitting the same event instance during dispatch', () => {
    const emitter = new EventEmitter<TestEvents>();
    const event = new Event<'tool:started', {toolId: string}>('tool:started', {
      details: {toolId: 'tool-1'},
    });

    emitter.on('tool:started', () => {
      emitter.emit(event);
    });

    expect(() => {
      emitter.emit(event);
    }).toThrowError('Cannot re-emit an event that is already in use.');
  });

  it('should emit silently when no listeners are registered', () => {
    const emitter = new EventEmitter<TestEvents>();

    const event = emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(event.type).toBe('tool:started');
    expect(event.propagationPath()).toEqual([emitter]);
  });

  it('should ignore off calls for patterns that were never registered', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    expect(() => {
      emitter.off('turn:ended', listener);
    }).not.toThrow();
  });

  it('should silently accept adding the same child to the same parent twice', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    const rootListener = vi.fn();

    root.addChild(child);
    const secondDetach = root.addChild(child);
    root.on('tool:started', rootListener);

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(rootListener).toHaveBeenCalledTimes(1);

    secondDetach();
    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(rootListener).toHaveBeenCalledTimes(1);
  });

  it('should tolerate detach functions being called multiple times', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    const detach = root.addChild(child);

    detach();

    expect(() => {
      detach();
    }).not.toThrow();
  });

  it('should tolerate on cleanup functions being called multiple times', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    const cleanup = emitter.on('tool:started', listener);

    cleanup();

    expect(() => {
      cleanup();
    }).not.toThrow();

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    expect(listener).not.toHaveBeenCalled();
  });

  it('should remove a once listener through its cleanup function before it fires', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    const cleanup = emitter.once('tool:started', listener);

    cleanup();
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should detect cycles in three-node chains', () => {
    const a = new EventEmitter<TestEvents>();
    const b = new EventEmitter<TestEvents>();
    const c = new EventEmitter<TestEvents>();
    a.addChild(b);
    b.addChild(c);

    expect(() => {
      c.addChild(a);
    }).toThrowError('Adding this child would create an event emitter cycle.');
  });

  it('should not detach a child from a different parent via removeChild', () => {
    const parentA = new EventEmitter<TestEvents>();
    const parentB = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    parentA.addChild(child);
    const parentAListener = vi.fn();
    parentA.on('tool:started', parentAListener);

    parentB.removeChild(child);

    child.emit('tool:started', {details: {toolId: 'tool-1'}});
    expect(parentAListener).toHaveBeenCalledTimes(1);
  });

  it('should not call a glob listener that does not match the emitted event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('turn:*', listener);
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should fire multiple glob patterns matching the same event in registration order', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on('tool:*', () => {
      calls.push('tool:*');
    });
    emitter.on('*:started', () => {
      calls.push('*:started');
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['tool:*', '*:started']);
  });

  it('should match glob listeners on parent emitters during bubbling', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const listener = vi.fn();

    root.on('tool:*', listener);
    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should fire a once glob listener only once', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.once('tool:*', listener);
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});
    emitter.emit('tool:ended', {details: {success: true, toolId: 'tool-1'}});

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should remove a glob listener through off', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('tool:*', listener);
    emitter.off('tool:*', listener);
    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should preserve listener order with once listeners interleaved', () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on('tool:started', () => {
      calls.push('on:first');
    });
    emitter.once('tool:started', () => {
      calls.push('once:second');
    });
    emitter.on('tool:started', () => {
      calls.push('on:third');
    });

    emitter.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['on:first', 'once:second', 'on:third']);
  });

  it('should reject re-emitting a dispatched event on a different emitter', () => {
    const emitterA = new EventEmitter<TestEvents>();
    const emitterB = new EventEmitter<TestEvents>();
    const event = new Event<'tool:started', {toolId: string}>('tool:started', {
      details: {toolId: 'tool-1'},
    });

    emitterA.emit(event);

    expect(() => {
      emitterB.emit(event);
    }).toThrowError('Cannot re-emit an event that is already in use.');
  });

  it('should not alter the propagation path when a child is detached during dispatch', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    child.on('tool:started', () => {
      calls.push('child');
      root.removeChild(child);
    });
    root.on('tool:started', () => {
      calls.push('root');
    });

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['child', 'root']);
  });

  it('should stop immediate propagation on a parent emitter listener during bubbling', () => {
    const root = new EventEmitter<TestEvents>();
    const child = new EventEmitter<TestEvents>();
    root.addChild(child);
    const calls: string[] = [];

    child.on('tool:started', () => {
      calls.push('child');
    });
    root.on('tool:started', (event) => {
      calls.push('root:first');
      event.stopImmediatePropagation();
    });
    root.on('tool:started', () => {
      calls.push('root:second');
    });

    child.emit('tool:started', {details: {toolId: 'tool-1'}});

    expect(calls).toEqual(['child', 'root:first']);
  });
});
