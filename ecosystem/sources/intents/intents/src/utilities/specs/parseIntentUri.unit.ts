import {describe, expect, it} from 'vitest';
import {parseIntentUri} from '../parseIntentUri';

describe('parseIntentUri', () => {
  it('should parse a basic URI with action and MIME type', () => {
    const result = parseIntentUri('create:application/vnd.ai.assistant.thing');

    expect(result).toEqual({
      action: 'create',
      mimeType: 'application/vnd.ai.assistant.thing',
    });
  });

  it('should parse query parameters into the input object', () => {
    const result = parseIntentUri('create:application/vnd.ai.assistant.thing?name=hello&count=3');

    expect(result).toEqual({
      action: 'create',
      mimeType: 'application/vnd.ai.assistant.thing',
      input: {name: 'hello', count: '3'},
    });
  });

  it('should detect vendor from the MIME type pattern', () => {
    const result = parseIntentUri('create:application/vnd.my-vendor.ai.assistant.thing');

    expect(result).toEqual({
      action: 'create',
      mimeType: 'application/vnd.my-vendor.ai.assistant.thing',
      vendor: 'my-vendor',
    });
  });

  it('should detect vendor and parse query parameters together', () => {
    const result = parseIntentUri(
      'navigate:application/vnd.acme.ai.assistant.dashboard?tab=overview',
    );

    expect(result).toEqual({
      action: 'navigate',
      mimeType: 'application/vnd.acme.ai.assistant.dashboard',
      vendor: 'acme',
      input: {tab: 'overview'},
    });
  });

  it('should not set vendor when MIME type starts with application/vnd.ai.assistant', () => {
    const result = parseIntentUri('create:application/vnd.ai.assistant.thing');

    expect(result.vendor).toBeUndefined();
  });

  it('should handle URL-encoded values in query parameters', () => {
    const result = parseIntentUri(
      'create:application/vnd.ai.assistant.thing?name=hello%20world&path=%2Fhome%2Fuser',
    );

    expect(result.input).toEqual({
      name: 'hello world',
      path: '/home/user',
    });
  });

  it('should handle plus signs as spaces in query parameters', () => {
    const result = parseIntentUri('search:application/vnd.ai.assistant.item?q=foo+bar');

    expect(result.input).toEqual({q: 'foo bar'});
  });

  it('should handle multiple query parameters', () => {
    const result = parseIntentUri(
      'filter:application/vnd.ai.assistant.list?status=active&sort=name&order=asc',
    );

    expect(result.input).toEqual({
      status: 'active',
      sort: 'name',
      order: 'asc',
    });
  });

  it('should omit input when there are no query parameters', () => {
    const result = parseIntentUri('view:application/vnd.ai.assistant.profile');

    expect(result.input).toBeUndefined();
  });

  it('should omit input when the query string is empty', () => {
    const result = parseIntentUri('view:application/vnd.ai.assistant.profile?');

    expect(result.input).toBeUndefined();
  });

  it('should handle non-vendor MIME types without setting vendor', () => {
    const result = parseIntentUri('open:text/plain');

    expect(result).toEqual({
      action: 'open',
      mimeType: 'text/plain',
    });
    expect(result.vendor).toBeUndefined();
  });

  it('should throw when the URI has no colon separator', () => {
    expect(() => parseIntentUri('invalid-uri')).toThrow('missing colon separator');
  });

  it('should throw when the action is empty', () => {
    expect(() => parseIntentUri(':application/vnd.ai.assistant.thing')).toThrow('empty action');
  });

  it('should throw when the MIME type is empty', () => {
    expect(() => parseIntentUri('create:')).toThrow('empty MIME type');
  });

  it('should throw when the MIME type is empty but query params exist', () => {
    expect(() => parseIntentUri('create:?name=hello')).toThrow('empty MIME type');
  });

  it('should handle query parameter values containing equals signs', () => {
    const result = parseIntentUri('run:application/vnd.ai.assistant.task?expr=a=b');

    expect(result.input).toEqual({expr: 'a=b'});
  });

  it('should use the last value when duplicate query keys are present', () => {
    const result = parseIntentUri('run:application/vnd.ai.assistant.task?key=first&key=second');

    expect(result.input).toEqual({key: 'second'});
  });
});
