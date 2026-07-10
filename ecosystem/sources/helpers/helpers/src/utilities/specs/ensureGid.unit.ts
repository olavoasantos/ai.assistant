import {describe, it, expect} from 'vitest';
import {ensureGid} from '../ensureGid';
import {generateGid} from '../generateGid';

describe('ensureGid', () => {
  it('should parse a valid GID and return all four parts', () => {
    const result = ensureGid('gid://ai.assistant/Session/abc123');

    expect(result).toEqual({
      prefix: 'gid',
      owner: 'ai.assistant',
      resource: 'Session',
      id: 'abc123',
    });
  });

  it('should return the correct prefix', () => {
    const result = ensureGid('urn://ai.assistant/Session/abc123');

    expect(result.prefix).toBe('urn');
  });

  it('should return the correct owner', () => {
    const result = ensureGid('gid://acme/Session/abc123');

    expect(result.owner).toBe('acme');
  });

  it('should return the correct resource', () => {
    const result = ensureGid('gid://ai.assistant/Agent/abc123');

    expect(result.resource).toBe('Agent');
  });

  it('should return the correct id', () => {
    const result = ensureGid('gid://ai.assistant/Session/xyz789');

    expect(result.id).toBe('xyz789');
  });

  it('should reject id containing slashes', () => {
    expect(() => ensureGid('gid://ai.assistant/Session/path/to/thing')).toThrow(TypeError);
  });

  it('should throw TypeError for empty string', () => {
    expect(() => ensureGid('')).toThrow(TypeError);
  });

  it('should throw TypeError for string missing "://"', () => {
    expect(() => ensureGid('gid:ai.assistant/Session/123')).toThrow(TypeError);
  });

  it('should throw TypeError for empty prefix', () => {
    expect(() => ensureGid('://ai.assistant/Session/123')).toThrow(TypeError);
  });

  it('should throw TypeError for empty owner', () => {
    expect(() => ensureGid('gid:///Session/123')).toThrow(TypeError);
  });

  it('should throw TypeError for empty resource', () => {
    expect(() => ensureGid('gid://ai.assistant//123')).toThrow(TypeError);
  });

  it('should throw TypeError for missing id', () => {
    expect(() => ensureGid('gid://ai.assistant/Session/')).toThrow(TypeError);
    expect(() => ensureGid('gid://ai.assistant/Session')).toThrow(TypeError);
  });

  it('should parse numeric-looking ids as strings', () => {
    const result = ensureGid('gid://ai.assistant/Session/42');

    expect(result.id).toBe('42');
  });

  it('should round-trip with generateGid using string overload', () => {
    const result = ensureGid(generateGid('Session'));

    expect(result.prefix).toBe('gid');
    expect(result.owner).toBe('ai.assistant');
    expect(result.resource).toBe('Session');
    expect(result.id).toHaveLength(8);
    expect(result.id).toMatch(/^[a-z0-9]+$/);
  });

  it('should round-trip with generateGid using options overload', () => {
    const result = ensureGid(
      generateGid({prefix: 'urn', owner: 'acme', resource: 'Document', id: 'final'}),
    );

    expect(result).toEqual({prefix: 'urn', owner: 'acme', resource: 'Document', id: 'final'});
  });
});
