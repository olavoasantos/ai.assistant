import {describe, it, expect} from 'vitest';
import {generateGid} from '../generateGid';

describe('generateGid', () => {
  describe('string overload', () => {
    it('should generate an ID with the correct format', () => {
      const name = 'test';
      const id = generateGid(name);

      expect(id.startsWith(`gid://ai.assistant/${name}/`)).toBe(true);
      const suffix = id.split(`gid://ai.assistant/${name}/`)[1];
      expect(suffix).toMatch(/^[a-z0-9]+$/i);
    });

    it('should generate unique IDs for each call', () => {
      const name = 'test';
      const ids = new Set();

      for (let i = 0; i < 1000; i++) {
        ids.add(generateGid(name));
      }

      expect(ids.size).toBe(1000);
    });

    it('should include the provided name in the generated ID', () => {
      const name = 'myName';
      const id = generateGid(name);

      expect(id).toContain(`ai.assistant/${name}`);
    });

    it('should generate IDs with a length greater than the name length', () => {
      const name = 'test';
      const id = generateGid(name);

      expect(id.length).toBeGreaterThan(name.length + 3);
    });
  });

  describe('options overload', () => {
    it('should use defaults for prefix and owner when only resource is provided', () => {
      const id = generateGid({resource: 'Agent'});

      expect(id).toMatch(/^gid:\/\/ai\.assistant\/Agent\/[a-z0-9]+$/);
    });

    it('should use a custom prefix', () => {
      const id = generateGid({prefix: 'urn', resource: 'Agent'});

      expect(id.startsWith('urn://ai.assistant/Agent/')).toBe(true);
    });

    it('should use a custom owner', () => {
      const id = generateGid({owner: 'acme', resource: 'Agent'});

      expect(id.startsWith('gid://acme/Agent/')).toBe(true);
    });

    it('should use an explicit string id verbatim', () => {
      const id = generateGid({resource: 'Agent', id: 'abc123'});

      expect(id).toBe('gid://ai.assistant/Agent/abc123');
    });

    it('should use an explicit numeric id', () => {
      const id = generateGid({resource: 'Agent', id: 42});

      expect(id).toBe('gid://ai.assistant/Agent/42');
    });

    it('should combine all options correctly', () => {
      const id = generateGid({
        prefix: 'urn',
        owner: 'acme',
        resource: 'Document',
        id: 'final-v2',
      });

      expect(id).toBe('urn://acme/Document/final-v2');
    });

    it('should generate a random id when id is not provided in options', () => {
      const id = generateGid({resource: 'Session'});
      const suffix = id.split('gid://ai.assistant/Session/')[1];

      expect(suffix).toHaveLength(8);
      expect(suffix).toMatch(/^[a-z0-9]+$/);
    });
  });
});
