import {describe, expect, it} from 'vitest';
import {enrichIssue} from '../enrichIssue';

describe('enrichIssue', () => {
  it('generates validation.{name} message key when no parent', () => {
    const issue = enrichIssue({}, {name: 'minLength', extras: undefined}, undefined, {});

    expect(issue.message).toBe('validation.minLength');
    expect(issue.rule).toBe('minLength');
  });

  it('generates validation.{parent}.{name} message key with parent', () => {
    const issue = enrichIssue({}, {name: 'minLength', extras: undefined}, 'string', {});

    expect(issue.message).toBe('validation.string.minLength');
    expect(issue.rule).toBe('minLength');
  });

  it('uses custom message from options.message when provided', () => {
    const issue = enrichIssue({}, {name: 'minLength', extras: undefined}, 'string', {
      message: 'Too short!',
    });

    expect(issue.message).toBe('Too short!');
  });

  it('merges descriptor extras with issue extras', () => {
    const issue = enrichIssue(
      {extras: {received: 2}},
      {name: 'minLength', extras: {min: 3}},
      undefined,
      {},
    );

    expect(issue.extras).toEqual({min: 3, received: 2});
  });

  it('returns no extras key when neither descriptor nor issue have extras', () => {
    const issue = enrichIssue({}, {name: 'required', extras: undefined}, undefined, {});

    expect(issue.extras).toBeUndefined();
  });
});
