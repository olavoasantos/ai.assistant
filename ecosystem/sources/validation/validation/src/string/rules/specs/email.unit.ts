import {describe, expect, it} from 'vitest';
import {email} from '../email';

describe('email', () => {
  it('passes a standard email', () => {
    const rule = email();
    const result = rule.validate('user@example.com');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('user@example.com');
  });

  it('passes a short domain email', () => {
    const rule = email();
    const result = rule.validate('a@b.co');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('a@b.co');
  });

  it('passes an email with a plus tag', () => {
    const rule = email();
    const result = rule.validate('user+tag@domain.org');

    expect(result.ok).toBe(true);
    expect(result.value).toBe('user+tag@domain.org');
  });

  it('fails an empty string', () => {
    const rule = email();
    const result = rule.validate('');

    expect(result.ok).toBe(false);
  });

  it('fails a plain string', () => {
    const rule = email();
    const result = rule.validate('not-email');

    expect(result.ok).toBe(false);
  });

  it('fails a string missing the local part', () => {
    const rule = email();
    const result = rule.validate('@domain.com');

    expect(result.ok).toBe(false);
  });

  it('fails a string missing the domain', () => {
    const rule = email();
    const result = rule.validate('user@');

    expect(result.ok).toBe(false);
  });

  it('fails a string with spaces', () => {
    const rule = email();
    const result = rule.validate('user @domain.com');

    expect(result.ok).toBe(false);
  });
});
