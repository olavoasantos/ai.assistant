import type {
  ActivityMode,
  ActivityResponse,
  ActivityResponder as ActivityResponderContract,
  ActivityResponseType,
} from '@ai.assistant/contracts/intents';
import type {Rule} from '@ai.assistant/contracts/validation';
import {ApplicationError} from '@ai.assistant/error';
import {
  ACTIVITY_RESPONDER_BUFFER,
  ACTIVITY_RESPONDER_COMPLETE,
  ACTIVITY_RESPONDER_DEFERRED,
  ACTIVITY_RESPONDER_DONE,
  ACTIVITY_RESPONDER_IDENTIFIER,
  ACTIVITY_RESPONDER_MODE,
  ACTIVITY_RESPONDER_OUTPUT_SCHEMA,
  ACTIVITY_RESPONDER_WAITERS,
} from '../constants';
import type {
  ActivityResponseController,
  ActivityResponseWaiter,
  DeferredActivityResponse,
} from '../types';

/**
 * Manages the response channel between an activity's handler and its consumer.
 *
 * Supports three execution modes:
 *
 * - **Awaitable** — a single response settles a promise. The consumer
 *   awaits `response` as a `Promise<ActivityResponse<T>>`.
 * - **Streaming** — multiple responses are yielded to an async iterator.
 *   The consumer iterates `response` as an `AsyncIterable<ActivityResponse<T>>`.
 * - **Detached** — no response mechanism. All respond methods throw.
 *
 * Response data is validated against an optional output schema before
 * being delivered to the consumer.
 *
 * @template T - The type of the success payload.
 */
export class ActivityResponder<T = unknown> implements ActivityResponseController<T> {
  /** @internal Symbol brand for cross-boundary identification. */
  readonly [ACTIVITY_RESPONDER_IDENTIFIER] = true;

  /** @internal The activity execution mode. */
  private [ACTIVITY_RESPONDER_MODE]: ActivityMode;

  /** @internal Optional validation rule for response data. */
  private [ACTIVITY_RESPONDER_OUTPUT_SCHEMA]: Rule<unknown, T> | undefined;

  /** @internal Whether the responder has completed. */
  private [ACTIVITY_RESPONDER_COMPLETE]: boolean;

  /** @internal Deferred promise for awaitable mode. */
  private [ACTIVITY_RESPONDER_DEFERRED]: DeferredActivityResponse<T> | undefined;

  /** @internal Buffered responses for streaming mode. */
  private [ACTIVITY_RESPONDER_BUFFER]: ActivityResponse<T>[] | undefined;

  /** @internal Pending consumers for streaming mode. */
  private [ACTIVITY_RESPONDER_WAITERS]: ActivityResponseWaiter<T>[] | undefined;

  /** @internal Whether the streaming iterator is terminated. */
  private [ACTIVITY_RESPONDER_DONE]: boolean | undefined;

  /**
   * Creates a new activity responder.
   *
   * @param mode - The execution mode determining response behavior.
   * @param outputSchema - Optional validation rule for success response data.
   */
  constructor(mode: ActivityMode, outputSchema?: Rule<unknown, T>) {
    this[ACTIVITY_RESPONDER_MODE] = mode;
    this[ACTIVITY_RESPONDER_OUTPUT_SCHEMA] = outputSchema;
    this[ACTIVITY_RESPONDER_COMPLETE] = mode === 'detached';

    if (mode === 'awaitable') {
      let resolve!: (value: ActivityResponse<T>) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<ActivityResponse<T>>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      this[ACTIVITY_RESPONDER_DEFERRED] = {promise, resolve, reject};
    }

    if (mode === 'streaming') {
      this[ACTIVITY_RESPONDER_BUFFER] = [];
      this[ACTIVITY_RESPONDER_WAITERS] = [];
      this[ACTIVITY_RESPONDER_DONE] = false;
      this[ACTIVITY_RESPONDER_COMPLETE] = false;
    }
  }

  /**
   * The handler-facing response API.
   *
   * Returns a namespace object with methods for sending structured
   * responses back to the consumer. Behavior varies by activity mode.
   */
  get respond(): ActivityResponderContract<T> {
    return {
      success: (data: T): void => this.handleSuccess(data),
      error: (error: ApplicationError): void => this.handleError(error),
      cancelled: (): void => this.handleCancelled(),
      send: (response: ActivityResponse<T>): void => this.handleSend(response),
      complete: (data?: T): void => this.handleComplete(data),
    };
  }

  /**
   * The consumer-facing response channel.
   *
   * The shape depends on the activity mode:
   * - Awaitable: `Promise<ActivityResponse<T>>`
   * - Streaming: `AsyncIterable<ActivityResponse<T>>`
   * - Detached: `undefined`
   */
  get response(): ActivityResponseType<T> {
    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      return this[ACTIVITY_RESPONDER_DEFERRED]!.promise;
    }

    if (mode === 'streaming') {
      return this.createAsyncIterable();
    }

    return undefined;
  }

  /**
   * Whether the responder has completed sending responses.
   *
   * For detached mode, always returns `true` since no responses
   * can be sent.
   */
  get isComplete(): boolean {
    return this[ACTIVITY_RESPONDER_COMPLETE];
  }

  /**
   * Disposes the responder, cleaning up any pending resources.
   *
   * If the responder has not completed:
   * - Awaitable: rejects the promise with an infrastructure error.
   * - Streaming: terminates the async iterator.
   */
  dispose(): void {
    if (this[ACTIVITY_RESPONDER_COMPLETE]) {
      return;
    }

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this[ACTIVITY_RESPONDER_DEFERRED]!.reject(
        new ApplicationError('Activity disposed before responding'),
      );
    }

    if (mode === 'streaming') {
      this.terminateStream();
    }

    this[ACTIVITY_RESPONDER_COMPLETE] = true;
  }

  /**
   * Validates data against the output schema if one is configured.
   *
   * @param data - The data to validate.
   * @returns The validated (and potentially transformed) data.
   * @throws ApplicationError when validation fails.
   */
  private validateOutput(data: T): T {
    const schema = this[ACTIVITY_RESPONDER_OUTPUT_SCHEMA];

    if (schema) {
      return schema.ensureParse(data);
    }

    return data;
  }

  /**
   * Ensures the responder is not in detached mode.
   *
   * @throws ApplicationError when the responder is detached.
   */
  private ensureNotDetached(): void {
    if (this[ACTIVITY_RESPONDER_MODE] === 'detached') {
      throw new ApplicationError('Cannot respond on a detached activity');
    }
  }

  /**
   * Ensures the responder has not already completed.
   *
   * @throws ApplicationError when a response has already been sent.
   */
  private ensureNotComplete(): void {
    if (this[ACTIVITY_RESPONDER_COMPLETE]) {
      if (this[ACTIVITY_RESPONDER_MODE] === 'detached') {
        throw new ApplicationError('Cannot respond on a detached activity');
      }
      throw new ApplicationError('Activity has already responded');
    }
  }

  /**
   * Handles a success response.
   *
   * @param data - The success payload to send.
   */
  private handleSuccess(data: T): void {
    this.ensureNotDetached();
    this.ensureNotComplete();

    const validatedData = this.validateOutput(data);
    const response: ActivityResponse<T> = {status: 'success', data: validatedData};

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this[ACTIVITY_RESPONDER_DEFERRED]!.resolve(response);
      this[ACTIVITY_RESPONDER_COMPLETE] = true;
    }

    if (mode === 'streaming') {
      this.pushToStream(response);
    }
  }

  /**
   * Handles an error response.
   *
   * @param error - The application error to send.
   */
  private handleError(error: ApplicationError): void {
    this.ensureNotDetached();
    this.ensureNotComplete();

    const response: ActivityResponse<T> = {status: 'error', error};

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this[ACTIVITY_RESPONDER_DEFERRED]!.resolve(response);
      this[ACTIVITY_RESPONDER_COMPLETE] = true;
    }

    if (mode === 'streaming') {
      this.pushToStream(response);
    }
  }

  /**
   * Handles a cancelled response.
   */
  private handleCancelled(): void {
    this.ensureNotDetached();
    this.ensureNotComplete();

    const response: ActivityResponse<T> = {status: 'cancelled'};

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this[ACTIVITY_RESPONDER_DEFERRED]!.resolve(response);
      this[ACTIVITY_RESPONDER_COMPLETE] = true;
    }

    if (mode === 'streaming') {
      this.pushToStream(response);
    }
  }

  /**
   * Handles sending a raw response envelope.
   *
   * @param response - The complete response envelope to send.
   */
  private handleSend(response: ActivityResponse<T>): void {
    this.ensureNotDetached();
    this.ensureNotComplete();

    if (response.status === 'success' && response.data !== undefined) {
      const validatedData = this.validateOutput(response.data);
      response = {...response, data: validatedData};
    }

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this[ACTIVITY_RESPONDER_DEFERRED]!.resolve(response);
      this[ACTIVITY_RESPONDER_COMPLETE] = true;
    }

    if (mode === 'streaming') {
      this.pushToStream(response);
    }
  }

  /**
   * Handles completing the response channel.
   *
   * @param data - Optional final success payload.
   */
  private handleComplete(data?: T): void {
    this.ensureNotDetached();
    this.ensureNotComplete();

    const mode = this[ACTIVITY_RESPONDER_MODE];

    if (mode === 'awaitable') {
      this.handleSuccess(data as T);
      return;
    }

    if (mode === 'streaming') {
      if (data !== undefined) {
        const validatedData = this.validateOutput(data);
        this.pushToStream({status: 'success', data: validatedData});
      }
      this.terminateStream();
      this[ACTIVITY_RESPONDER_COMPLETE] = true;
    }
  }

  /**
   * Pushes a response to the streaming queue.
   *
   * If there are waiting consumers, resolves the first waiter.
   * Otherwise, buffers the response for later consumption.
   *
   * @param value - The response to push.
   */
  private pushToStream(value: ActivityResponse<T>): void {
    const waiters = this[ACTIVITY_RESPONDER_WAITERS]!;

    if (waiters.length > 0) {
      const waiter = waiters.shift()!;
      waiter.resolve({value, done: false});
    } else {
      this[ACTIVITY_RESPONDER_BUFFER]!.push(value);
    }
  }

  /**
   * Terminates the streaming iterator.
   *
   * Resolves all pending waiters with a done result and marks
   * the stream as complete.
   */
  private terminateStream(): void {
    this[ACTIVITY_RESPONDER_DONE] = true;
    const waiters = this[ACTIVITY_RESPONDER_WAITERS]!;

    for (const waiter of waiters) {
      waiter.resolve({value: undefined as unknown as ActivityResponse<T>, done: true});
    }

    waiters.length = 0;
  }

  /**
   * Creates an async iterable iterator for streaming mode.
   *
   * Implements a push-pull queue pattern where the producer (respond
   * methods) and consumer (for-await-of) coordinate through buffers
   * and waiters.
   *
   * @returns An async iterable iterator that yields activity responses.
   */
  private createAsyncIterable(): AsyncIterableIterator<ActivityResponse<T>> {
    const buffer = this[ACTIVITY_RESPONDER_BUFFER]!;
    const waiters = this[ACTIVITY_RESPONDER_WAITERS]!;
    const self = this;

    const iterator: AsyncIterableIterator<ActivityResponse<T>> = {
      next(): Promise<IteratorResult<ActivityResponse<T>>> {
        if (buffer.length > 0) {
          return Promise.resolve({value: buffer.shift()!, done: false});
        }

        if (self[ACTIVITY_RESPONDER_DONE]) {
          return Promise.resolve({
            value: undefined as unknown as ActivityResponse<T>,
            done: true,
          });
        }

        return new Promise((resolve) => {
          waiters.push({resolve});
        });
      },

      [Symbol.asyncIterator]() {
        return iterator;
      },
    };

    return iterator;
  }
}
