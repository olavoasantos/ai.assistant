import {describe, expect, expectTypeOf, it} from 'vitest';
import {Event} from '../Event';

// @ts-expect-error payload-bearing events require explicit details
const invalidEvent = () => new Event<'tool:started', {toolId: string}>('tool:started');

describe('Event', () => {
  it('should initialize with defaults', () => {
    const event = new Event('tool:started');

    expect(event.type).toBe('tool:started');
    expect(event.details).toBeUndefined();
    expect(event.bubbles).toBe(true);
    expect(event.origin).toBeNull();
    expect(event.currentEmitter).toBeNull();
    expect(event.propagationStopped).toBe(false);
    expect(event.immediatePropagationStopped).toBe(false);
    expect(event.propagationPath()).toEqual([]);
  });

  it('should allow omitting details when the payload type is undefined', () => {
    const event = new Event('turn:ended');

    expectTypeOf(event.details).toEqualTypeOf<undefined>();
    expect(event.details).toBeUndefined();
  });

  it('should require details for payload-bearing events at compile time', () => {
    expectTypeOf(invalidEvent).toEqualTypeOf<() => Event<'tool:started', {toolId: string}>>();
  });

  it('should accept explicit options', () => {
    const event = new Event('tool:started', {
      bubbles: false,
      details: {toolId: 'tool-1'},
    });

    expect(event.bubbles).toBe(false);
    expect(event.details).toEqual({toolId: 'tool-1'});
  });

  it('should stop propagation when stopPropagation is called', () => {
    const event = new Event('tool:started');

    event.stopPropagation();

    expect(event.propagationStopped).toBe(true);
    expect(event.immediatePropagationStopped).toBe(false);
  });

  it('should stop immediate propagation when stopImmediatePropagation is called', () => {
    const event = new Event('tool:started');

    event.stopImmediatePropagation();

    expect(event.propagationStopped).toBe(true);
    expect(event.immediatePropagationStopped).toBe(true);
  });

  it('should return a copy of the propagation path', () => {
    const event = new Event('tool:started');
    const path = event.propagationPath();

    expect(path).toEqual([]);
    expect(path).not.toBe(event.propagationPath());
  });
});
