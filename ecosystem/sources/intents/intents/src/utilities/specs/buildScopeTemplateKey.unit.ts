import {describe, expect, it} from 'vitest';
import {buildScopeTemplateKey} from '../buildScopeTemplateKey';

describe('buildScopeTemplateKey', () => {
  it('joins scope and kernel names', () => {
    expect(buildScopeTemplateKey('main', 'default')).toBe('main:default');
  });
});
