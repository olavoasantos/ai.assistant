import {describe, it, expect} from 'vitest';
import {generateId} from '../generateId';

describe('generateId', () => {
  it('should generate an ID with the correct format', () => {
    const name = 'test';
    const id = generateId(name);

    expect(id.startsWith(`${name}:`)).toBe(true);
    const suffix = id.split(`${name}:`)[1];
    expect(suffix).toMatch(/^[a-z0-9]+$/i);
  });

  it('should default to the "ai.assistant" prefix when no argument is provided', () => {
    const id = generateId();

    expect(id.startsWith('ai.assistant:')).toBe(true);
  });

  it('should generate a suffix of exactly 8 characters', () => {
    const id = generateId('test');
    const suffix = id.split(':')[1];

    expect(suffix).toHaveLength(8);
  });

  it('should generate unique IDs for each call', () => {
    const name = 'test';
    const ids = new Set();

    for (let i = 0; i < 1000; i++) {
      ids.add(generateId(name));
    }

    expect(ids.size).toBe(1000);
  });

  it('should include the provided name in the generated ID', () => {
    const name = 'myName';
    const id = generateId(name);

    expect(id).toContain(`${name}:`);
  });

  it('should generate IDs with a length greater than the name length', () => {
    const name = 'test';
    const id = generateId(name);

    expect(id.length).toBeGreaterThan(name.length + 3);
  });
});
