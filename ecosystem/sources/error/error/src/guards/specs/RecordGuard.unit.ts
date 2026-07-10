import {describe, expect, it} from 'vitest';
import {RecordGuard} from '../RecordGuard';

describe('RecordGuard', () => {
  it('should return true for plain objects', () => {
    expect(RecordGuard({})).toBe(true);
    expect(RecordGuard({a: 1, b: 'two'})).toBe(true);
  });

  it('should return true for Object.create(null)', () => {
    expect(RecordGuard(Object.create(null))).toBe(true);
  });

  it('should return true for class instances', () => {
    class Foo {
      value = 1;
    }
    expect(RecordGuard(new Foo())).toBe(true);
  });

  it('should return false for arrays', () => {
    expect(RecordGuard([])).toBe(false);
    expect(RecordGuard([1, 2, 3])).toBe(false);
  });

  it('should return false for null', () => {
    expect(RecordGuard(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(RecordGuard(undefined)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(RecordGuard(42)).toBe(false);
    expect(RecordGuard('string')).toBe(false);
    expect(RecordGuard(true)).toBe(false);
    expect(RecordGuard(Symbol('test'))).toBe(false);
    expect(RecordGuard(BigInt(42))).toBe(false);
  });

  it('should return false for functions', () => {
    expect(RecordGuard(() => {})).toBe(false);
  });
});
