import {describe, expect, it} from 'vitest';
import {deletePath} from '../deletePath';

describe('deletePath', () => {
  it('should delete a top-level key with a single-segment path', () => {
    const target: Record<string, any> = {name: 'Alice', age: 30};
    deletePath(target, 'name');

    expect(target).toEqual({age: 30});
  });

  it('should delete a nested key with a multi-segment path', () => {
    const target = {a: {b: {c: 42, d: 99}}};
    deletePath(target, 'a.b.c');

    expect(target.a.b).toEqual({d: 99});
  });

  it('should no-op when an intermediate key is missing', () => {
    const target = {a: {b: 1}};
    deletePath(target, 'a.x.y');

    expect(target).toEqual({a: {b: 1}});
  });

  it('should no-op when the leaf key is missing', () => {
    const target = {a: {b: 1}};
    deletePath(target, 'a.z');

    expect(target).toEqual({a: {b: 1}});
  });

  it('should not affect sibling keys', () => {
    const target = {a: {b: 1, c: 2}};
    deletePath(target, 'a.b');

    expect(target.a.c).toBe(2);
    expect(target.a).toEqual({c: 2});
  });

  it('should remove the key entirely rather than setting it to undefined', () => {
    const target: Record<string, any> = {a: 1};
    deletePath(target, 'a');

    expect('a' in target).toBe(false);
  });
});
