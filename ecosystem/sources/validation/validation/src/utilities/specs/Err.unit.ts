import {describe, expect, it} from 'vitest';
import {Err} from '../Err';

describe('Err', () => {
  it('returns { ok: false } with no issues property when called without arguments', () => {
    const result = Err();

    expect(result).toEqual({ok: false});
    expect('issues' in result).toBe(false);
  });

  it('returns { ok: false, issues } with a single issue', () => {
    const result = Err({message: 'bad'});

    expect(result).toEqual({ok: false, issues: [{message: 'bad'}]});
  });

  it('returns { ok: false, issues } with multiple issues', () => {
    const result = Err({message: 'a'}, {message: 'b'});

    expect(result).toEqual({ok: false, issues: [{message: 'a'}, {message: 'b'}]});
  });
});
