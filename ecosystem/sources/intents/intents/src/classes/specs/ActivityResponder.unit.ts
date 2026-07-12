import type {ActivityResponse} from '@ai.assistant/contracts/intents';
import type {Rule} from '@ai.assistant/contracts/validation';
import {ApplicationError} from '@ai.assistant/error';
import {describe, expect, it} from 'vitest';
import {ActivityResponder} from '../ActivityResponder';

/**
 * Creates a mock output schema that validates data against a predicate.
 *
 * @param predicate - Returns `true` if the value is valid.
 * @returns A minimal Rule-compatible object.
 */
function createMockSchema<T>(predicate: (value: unknown) => boolean): Rule<unknown, T> {
  return {
    ensureParse(value: unknown): T {
      if (!predicate(value)) {
        throw new ApplicationError('Validation failed');
      }
      return value as T;
    },
  } as Rule<unknown, T>;
}

describe('ActivityResponder', () => {
  describe('awaitable mode', () => {
    it('should resolve with a success response', async () => {
      const responder = new ActivityResponder<string>('awaitable');

      responder.respond.success('hello');

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'success', data: 'hello'});
    });

    it('should resolve with an error response without rejecting', async () => {
      const responder = new ActivityResponder<string>('awaitable');
      const error = new ApplicationError('Something went wrong');

      responder.respond.error(error);

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result.status).toBe('error');
      expect(result.error).toBe(error);
    });

    it('should resolve with a cancelled response', async () => {
      const responder = new ActivityResponder<string>('awaitable');

      responder.respond.cancelled();

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'cancelled'});
    });

    it('should resolve with a raw response via send()', async () => {
      const responder = new ActivityResponder<string>('awaitable');
      const response: ActivityResponse<string> = {status: 'success', data: 'sent'};

      responder.respond.send(response);

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'success', data: 'sent'});
    });

    it('should alias success(data) when complete(data) is called', async () => {
      const responder = new ActivityResponder<string>('awaitable');

      responder.respond.complete('done');

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'success', data: 'done'});
    });

    it('should send success with undefined when complete() is called without data', async () => {
      const responder = new ActivityResponder<string | undefined>('awaitable');

      responder.respond.complete();

      const result = await (responder.response as Promise<ActivityResponse<string | undefined>>);
      expect(result.status).toBe('success');
      expect(result.data).toBeUndefined();
    });

    it('should throw when responding twice', () => {
      const responder = new ActivityResponder<string>('awaitable');

      responder.respond.success('first');

      expect(() => responder.respond.success('second')).toThrow('Activity has already responded');
    });

    it('should set isComplete to true after responding', () => {
      const responder = new ActivityResponder<string>('awaitable');

      expect(responder.isComplete).toBe(false);

      responder.respond.success('done');

      expect(responder.isComplete).toBe(true);
    });

    it('should validate data against outputSchema when valid', async () => {
      const schema = createMockSchema<number>((v) => typeof v === 'number');
      const responder = new ActivityResponder<number>('awaitable', schema);

      responder.respond.success(42);

      const result = await (responder.response as Promise<ActivityResponse<number>>);
      expect(result).toEqual({status: 'success', data: 42});
    });

    it('should throw when outputSchema validation fails', () => {
      const schema = createMockSchema<number>((v) => typeof v === 'number');
      const responder = new ActivityResponder<number>('awaitable', schema);

      expect(() => responder.respond.success('not a number' as unknown as number)).toThrow(
        'Validation failed',
      );
    });

    it('should validate data in send() when status is success', async () => {
      const schema = createMockSchema<string>((v) => typeof v === 'string');
      const responder = new ActivityResponder<string>('awaitable', schema);

      responder.respond.send({status: 'success', data: 'valid'});

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'success', data: 'valid'});
    });

    it('should reject the promise when disposed before responding', async () => {
      const responder = new ActivityResponder<string>('awaitable');
      const promise = responder.response as Promise<ActivityResponse<string>>;

      responder.dispose();

      await expect(promise).rejects.toThrow('Activity disposed before responding');
    });

    it('should not reject when disposed after responding', async () => {
      const responder = new ActivityResponder<string>('awaitable');

      responder.respond.success('done');
      responder.dispose();

      const result = await (responder.response as Promise<ActivityResponse<string>>);
      expect(result).toEqual({status: 'success', data: 'done'});
    });
  });

  describe('streaming mode', () => {
    it('should yield a success response to the iterator', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.respond.success('chunk1');

      const result = await iterable.next();
      expect(result).toEqual({value: {status: 'success', data: 'chunk1'}, done: false});
    });

    it('should yield multiple success responses', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.respond.success('a');
      responder.respond.success('b');
      responder.respond.success('c');

      const first = await iterable.next();
      const second = await iterable.next();
      const third = await iterable.next();

      expect(first.value).toEqual({status: 'success', data: 'a'});
      expect(second.value).toEqual({status: 'success', data: 'b'});
      expect(third.value).toEqual({status: 'success', data: 'c'});
    });

    it('should yield an error response to the iterator', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;
      const error = new ApplicationError('Stream error');

      responder.respond.error(error);

      const result = await iterable.next();
      expect(result.value.status).toBe('error');
      expect(result.value.error).toBe(error);
    });

    it('should terminate the iterator when complete() is called', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.respond.complete();

      const result = await iterable.next();
      expect(result.done).toBe(true);
    });

    it('should yield a final success then terminate when complete(data) is called', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.respond.complete('final');

      const first = await iterable.next();
      expect(first).toEqual({value: {status: 'success', data: 'final'}, done: false});

      const second = await iterable.next();
      expect(second.done).toBe(true);
    });

    it('should support for-await-of iteration', async () => {
      const responder = new ActivityResponder<number>('streaming');
      const iterable = responder.response as AsyncIterable<ActivityResponse<number>>;
      const collected: ActivityResponse<number>[] = [];

      responder.respond.success(1);
      responder.respond.success(2);
      responder.respond.success(3);
      responder.respond.complete();

      for await (const response of iterable) {
        collected.push(response);
      }

      expect(collected).toEqual([
        {status: 'success', data: 1},
        {status: 'success', data: 2},
        {status: 'success', data: 3},
      ]);
    });

    it('should throw when responding after complete', () => {
      const responder = new ActivityResponder<string>('streaming');

      responder.respond.complete();

      expect(() => responder.respond.success('late')).toThrow('Activity has already responded');
    });

    it('should set isComplete to true after complete', () => {
      const responder = new ActivityResponder<string>('streaming');

      expect(responder.isComplete).toBe(false);

      responder.respond.complete();

      expect(responder.isComplete).toBe(true);
    });

    it('should validate each success response against outputSchema', async () => {
      const schema = createMockSchema<number>((v) => typeof v === 'number');
      const responder = new ActivityResponder<number>('streaming', schema);
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<number>>;

      responder.respond.success(1);
      responder.respond.success(2);

      const first = await iterable.next();
      const second = await iterable.next();

      expect(first.value).toEqual({status: 'success', data: 1});
      expect(second.value).toEqual({status: 'success', data: 2});
    });

    it('should throw when outputSchema validation fails on success', () => {
      const schema = createMockSchema<number>((v) => typeof v === 'number');
      const responder = new ActivityResponder<number>('streaming', schema);

      expect(() => responder.respond.success('bad' as unknown as number)).toThrow(
        'Validation failed',
      );
    });

    it('should terminate the iterator when disposed', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.dispose();

      const result = await iterable.next();
      expect(result.done).toBe(true);
    });

    it('should resolve pending waiters when disposed', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      // Start waiting for next value before anything is pushed
      const pendingPromise = iterable.next();

      responder.dispose();

      const result = await pendingPromise;
      expect(result.done).toBe(true);
    });

    it('should yield a cancelled response to the iterator', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;

      responder.respond.cancelled();

      const result = await iterable.next();
      expect(result.value).toEqual({status: 'cancelled'});
    });

    it('should yield a raw response via send()', async () => {
      const responder = new ActivityResponder<string>('streaming');
      const iterable = responder.response as AsyncIterableIterator<ActivityResponse<string>>;
      const response: ActivityResponse<string> = {status: 'success', data: 'raw'};

      responder.respond.send(response);

      const result = await iterable.next();
      expect(result.value).toEqual({status: 'success', data: 'raw'});
    });
  });

  describe('detached mode', () => {
    it('should throw on success()', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(() => responder.respond.success('nope')).toThrow(
        'Cannot respond on a detached activity',
      );
    });

    it('should throw on error()', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(() => responder.respond.error(new ApplicationError('nope'))).toThrow(
        'Cannot respond on a detached activity',
      );
    });

    it('should throw on cancelled()', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(() => responder.respond.cancelled()).toThrow('Cannot respond on a detached activity');
    });

    it('should throw on send()', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(() => responder.respond.send({status: 'success', data: 'nope'})).toThrow(
        'Cannot respond on a detached activity',
      );
    });

    it('should throw on complete()', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(() => responder.respond.complete()).toThrow('Cannot respond on a detached activity');
    });

    it('should return undefined for response', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(responder.response).toBeUndefined();
    });

    it('should report isComplete as true', () => {
      const responder = new ActivityResponder<string>('detached');

      expect(responder.isComplete).toBe(true);
    });
  });
});
