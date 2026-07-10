import {describe, expect, it} from 'vitest';
import {EventEmitter} from '../../classes/EventEmitter';
import {EventEmitterGuard} from '../EventEmitterGuard';

describe('EventEmitterGuard', () => {
  it('should accept a branded EventEmitter instance', () => {
    const emitter = new EventEmitter();

    expect(EventEmitterGuard.is(emitter)).toBe(true);
  });

  it('should reject null', () => {
    expect(EventEmitterGuard.is(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(EventEmitterGuard.is(undefined)).toBe(false);
  });

  it('should reject primitives', () => {
    expect(EventEmitterGuard.is('hello')).toBe(false);
    expect(EventEmitterGuard.is(42)).toBe(false);
    expect(EventEmitterGuard.is(true)).toBe(false);
  });

  it('should reject plain objects that structurally resemble an EventEmitter', () => {
    const fake = {
      on: () => () => undefined,
      once: () => () => undefined,
      off: () => undefined,
      emit: () => ({}) as any,
      addChild: () => () => undefined,
      removeChild: () => undefined,
    };

    expect(EventEmitterGuard.is(fake)).toBe(false);
  });

  it('should reject objects with wrong brand value', () => {
    const fake = {[Symbol.for('ai.assistant:EventEmitter')]: false};

    expect(EventEmitterGuard.is(fake)).toBe(false);
  });

  it('should parse a branded EventEmitter and return it', () => {
    const emitter = new EventEmitter();

    expect(EventEmitterGuard.parse(emitter)).toBe(emitter);
  });

  it('should return undefined when parsing a non-EventEmitter', () => {
    expect(EventEmitterGuard.parse({})).toBeUndefined();
  });

  it('should throw on ensureParse with a non-EventEmitter value', () => {
    expect(() => EventEmitterGuard.ensureParse({})).toThrow();
  });

  it('should accept a forged brand (documents trust-based boundary)', () => {
    const forged = {[Symbol.for('ai.assistant:EventEmitter')]: true};

    // Brand identity is trust-based: any object with the brand symbol
    // set to true is accepted. This is the deliberate Symbol.for() trade-off.
    expect(EventEmitterGuard.is(forged)).toBe(true);
  });
});
