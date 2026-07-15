import {describe, expect, it} from 'vitest';
import {Event} from '../../classes/Event';
import {EventGuard} from '../EventGuard';

describe('EventGuard', () => {
  it('should accept a branded Event instance', () => {
    const event = new Event('test:emitted');

    expect(EventGuard.is(event)).toBe(true);
  });

  it('should reject null', () => {
    expect(EventGuard.is(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(EventGuard.is(undefined)).toBe(false);
  });

  it('should reject primitives', () => {
    expect(EventGuard.is('hello')).toBe(false);
    expect(EventGuard.is(42)).toBe(false);
    expect(EventGuard.is(true)).toBe(false);
  });

  it('should reject plain objects that structurally resemble an Event', () => {
    const fake = {
      type: 'test:emitted',
      details: undefined,
      bubbles: true,
      origin: null,
      currentEmitter: null,
      propagationStopped: false,
      immediatePropagationStopped: false,
      stopPropagation: () => undefined,
      stopImmediatePropagation: () => undefined,
      propagationPath: () => [],
    };

    expect(EventGuard.is(fake)).toBe(false);
  });

  it('should reject objects with wrong brand value', () => {
    const fake = {[Symbol.for('ai.assistant:Event')]: false};

    expect(EventGuard.is(fake)).toBe(false);
  });

  it('should parse a branded Event and return it', () => {
    const event = new Event('test:emitted');

    expect(EventGuard.parse(event)).toBe(event);
  });

  it('should return undefined when parsing a non-Event', () => {
    expect(EventGuard.parse({})).toBeUndefined();
  });

  it('should throw on ensureParse with a non-Event value', () => {
    expect(() => EventGuard.ensureParse({})).toThrow();
  });

  it('should accept a forged brand (documents trust-based boundary)', () => {
    const forged = {[Symbol.for('ai.assistant:Event')]: true};

    // Brand identity is trust-based: any object with the brand symbol
    // set to true is accepted. This is the deliberate Symbol.for() trade-off.
    expect(EventGuard.is(forged)).toBe(true);
  });
});
