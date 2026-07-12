import {describe, expect, it} from 'vitest';
import {normalizeIntentQuery} from '../normalizeIntentQuery';

describe('normalizeIntentQuery', () => {
  it('copies object queries', () => {
    const query = {action: 'create'};

    expect(normalizeIntentQuery(query)).toEqual(query);
    expect(normalizeIntentQuery(query)).not.toBe(query);
  });

  it('parses URIs and lets explicit options replace URI input', () => {
    expect(
      normalizeIntentQuery('create:text/plain?source=uri', {input: {source: 'options'}}),
    ).toEqual({action: 'create', mimeType: 'text/plain', input: {source: 'options'}});
  });
});
