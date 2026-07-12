import {describe, expect, it} from 'vitest';
import {buildIntentIdentityKey} from '../buildIntentIdentityKey';

describe('buildIntentIdentityKey', () => {
  it('joins every immutable identity field', () => {
    expect(buildIntentIdentityKey('create', 'text/plain', 'main', 'default', 'acme')).toBe(
      'create:text/plain:main:default:acme',
    );
  });
});
