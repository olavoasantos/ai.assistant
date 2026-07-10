import {describe, it, expect} from 'vitest';
import {getPath} from '../getPath';

describe('getPath', () => {
  const data = {
    user: {
      profile: {
        name: 'John Doe',
        age: 30,
      },
      settings: {
        theme: 'dark',
      },
    },
  };

  it('should return the value for a valid path', () => {
    expect(getPath(data, 'user.profile.name')).toBe('John Doe');
    expect(getPath(data, 'user.profile.age')).toBe(30);
    expect(getPath(data, 'user.settings.theme')).toBe('dark');
  });

  it('should return undefined for an invalid path', () => {
    // @ts-expect-error - testing invalid path
    expect(getPath(data, 'user.profile.email')).toBeUndefined();
    // @ts-expect-error - testing invalid path
    expect(getPath(data, 'user.address.city')).toBeUndefined();
  });

  it('should return undefined for a partially valid path', () => {
    // @ts-expect-error - testing partially valid path
    expect(getPath(data, 'user.profile.age.value')).toBeUndefined();
  });

  it('should handle empty path', () => {
    expect(getPath(data, '')).toBe(data);
  });

  it('should handle null or undefined object', () => {
    // @ts-expect-error - testing null object
    expect(getPath(null, 'user.profile.name')).toBeUndefined();
    // @ts-expect-error - testing undefined object
    expect(getPath(undefined, 'user.profile.name')).toBeUndefined();
  });

  it('should handle path pointing to a non-object value', () => {
    const nestedData = {
      a: {
        b: 'string value',
      },
    };

    // @ts-expect-error - testing path beyond non-object value
    expect(getPath(nestedData, 'a.b.c')).toBeUndefined();
  });

  it('should return the entire object for an empty path', () => {
    expect(getPath(data, 'user')).toEqual({
      profile: {
        name: 'John Doe',
        age: 30,
      },
      settings: {
        theme: 'dark',
      },
    });
  });
});
