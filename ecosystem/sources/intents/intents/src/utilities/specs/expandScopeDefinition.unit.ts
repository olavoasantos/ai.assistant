import type {Kernel} from '@ai.assistant/contracts/executable';
import {describe, expect, it} from 'vitest';
import {expandScopeDefinitions} from '../expandScopeDefinition';

describe('expandScopeDefinitions', () => {
  it('creates one template for each scope and kernel pair', () => {
    const kernels: Kernel[] = [{name: 'first'}, {name: 'second'}];

    const templates = expandScopeDefinitions({scopes: [{scope: 'main', kernels}]});

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.kernel.name)).toEqual(['first', 'second']);
  });

  it('returns no templates when no scopes are configured', () => {
    expect(expandScopeDefinitions()).toEqual([]);
  });
});
