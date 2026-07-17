import type * as Contract from '@ai.assistant/contracts/error';
import {INVALID_SERIALIZED_ERROR_MESSAGE, ISO_8601_TIMESTAMP_PATTERN} from '../constants';
import type {
  ApplicationErrorConstructor,
  ErrorIssueConstructor,
  SerializedCloneEntry,
  SerializedCloneFrame,
  SerializedContainer,
  SerializedErrorParserContract,
} from '../types';

/**
 * Strictly reconstructs structured errors from untrusted serialized values.
 *
 * The parser accepts only own data properties on ordinary records, rebuilds
 * mutable structures, and applies an independent finite depth to issue and
 * cause traversal. Invalid input is surfaced as a fresh application error
 * without retaining the rejected value.
 *
 * @template ErrorType - Concrete application error produced by the parser.
 * @template IssueType - Concrete error issue produced by the parser.
 */
export class SerializedErrorParser<
  ErrorType extends Contract.ApplicationError,
  IssueType extends Contract.ErrorIssue,
> implements SerializedErrorParserContract<ErrorType> {
  readonly #ApplicationError: ApplicationErrorConstructor<ErrorType>;
  readonly #ErrorIssue: ErrorIssueConstructor<IssueType>;
  readonly #depth: number;
  readonly #active = new WeakSet<object>();

  /**
   * Creates a parser for concrete error and issue constructors.
   *
   * @param ApplicationError - Concrete application error constructor.
   * @param ErrorIssue - Concrete error issue constructor.
   * @param depth - Maximum nested issue and cause depth.
   */
  constructor(
    ApplicationError: ApplicationErrorConstructor<ErrorType>,
    ErrorIssue: ErrorIssueConstructor<IssueType>,
    depth: number,
  ) {
    this.#ApplicationError = ApplicationError;
    this.#ErrorIssue = ErrorIssue;
    this.#depth = depth;
  }

  /**
   * Reconstructs a fresh application error from an untrusted value.
   *
   * @param value - Serialized error value to parse.
   * @returns A fresh concrete application error.
   * @throws A fresh application error when the value is malformed.
   */
  parse(value: unknown): ErrorType {
    try {
      if (!Number.isSafeInteger(this.#depth) || this.#depth < 0) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }

      return this.#parseApplicationError(value, this.#depth);
    } catch {
      throw new this.#ApplicationError({
        message: INVALID_SERIALIZED_ERROR_MESSAGE,
        code: 400,
      });
    }
  }

  #parseApplicationError(value: unknown, depth: number): ErrorType {
    const record = this.#readRecord(value);
    this.#enter(record);

    try {
      const message = this.#readString(record, 'message');
      const code = this.#readNumber(record, 'code');
      const severity = this.#readSeverity(record);
      const metadata = this.#cloneMetadata(this.#readOwnValue(record, 'metadata'));
      const timestamp = this.#readTimestamp(record);
      const reference = this.#readOptionalString(record, 'reference');
      const stack = this.#readOptionalString(record, 'stack');
      const issues = depth > 0 ? this.#readOwnValue(record, 'issues') : undefined;
      const cause = depth > 0 ? this.#readOwnValue(record, 'cause') : undefined;

      if (depth > 0 && issues !== undefined && !Array.isArray(issues)) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }
      if (depth > 0 && cause !== undefined) {
        this.#readRecord(cause);
      }

      const error = new this.#ApplicationError({
        message,
        code,
        severity,
        reference,
        metadata,
        timestamp,
        cause:
          cause !== undefined && depth > 0
            ? this.#parseApplicationError(cause, depth - 1)
            : undefined,
      });

      if (stack === undefined) {
        delete error.stack;
      } else {
        error.stack = stack;
      }

      if (depth > 0 && Array.isArray(issues)) {
        this.#assertOrdinaryArray(issues);
        for (let index = 0; index < issues.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(issues, String(index));
          if (descriptor === undefined || !('value' in descriptor)) {
            throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
          }
          error.add(this.#parseIssue(descriptor.value, depth - 1));
        }
      }

      return error;
    } finally {
      this.#active.delete(record);
    }
  }

  #parseIssue(value: unknown, depth: number): IssueType {
    const record = this.#readRecord(value);
    this.#enter(record);

    try {
      const message = this.#readString(record, 'message');
      const pathValue = this.#readOwnValue(record, 'path');
      const causeValue = depth > 0 ? this.#readOwnValue(record, 'cause') : undefined;
      const path = pathValue === undefined ? undefined : this.#clonePath(pathValue);

      if (depth > 0 && causeValue !== undefined) {
        this.#readRecord(causeValue);
      }

      return new this.#ErrorIssue({
        message,
        path,
        cause:
          causeValue !== undefined && depth > 0
            ? this.#parseIssueCause(causeValue, depth - 1)
            : undefined,
      });
    } finally {
      this.#active.delete(record);
    }
  }

  #parseIssueCause(value: unknown, depth: number): ErrorType | IssueType | Error {
    const record = this.#readRecord(value);
    const codeDescriptor = Object.getOwnPropertyDescriptor(record, 'code');

    if (codeDescriptor !== undefined) {
      return this.#parseApplicationError(record, depth);
    }

    const pathDescriptor = Object.getOwnPropertyDescriptor(record, 'path');
    const causeDescriptor = Object.getOwnPropertyDescriptor(record, 'cause');

    if (pathDescriptor !== undefined || causeDescriptor !== undefined) {
      return this.#parseIssue(record, depth);
    }

    const message = this.#readString(record, 'message');
    const stack = this.#readOptionalString(record, 'stack');
    const error = new Error(message);

    if (stack === undefined) {
      delete error.stack;
    } else {
      error.stack = stack;
    }

    return error;
  }

  #cloneMetadata(value: unknown): Contract.ErrorMetadata {
    const record = this.#readRecord(value);
    return this.#cloneJSONValue(record) as Contract.ErrorMetadata;
  }

  #clonePath(value: unknown): PropertyKey[] {
    if (!Array.isArray(value)) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }

    this.#assertOrdinaryArray(value);
    const path: PropertyKey[] = [];

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor)) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }
      if (
        typeof descriptor.value !== 'string' &&
        (typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value))
      ) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }
      path.push(descriptor.value);
    }

    return path;
  }

  #cloneJSONValue(value: unknown): unknown {
    const source = this.#readRecord(value);
    const root: SerializedContainer = {};
    const active = new WeakSet<object>();
    const clones = new WeakMap<object, SerializedContainer>();
    const frames: SerializedCloneFrame[] = [this.#createCloneFrame(source, root)];

    active.add(source);
    clones.set(source, root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame === undefined) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }
      if (frame.index >= frame.entries.length) {
        active.delete(frame.source);
        frames.pop();
        continue;
      }

      const entry = frame.entries[frame.index];
      frame.index += 1;

      if (
        entry.value === null ||
        typeof entry.value === 'string' ||
        typeof entry.value === 'boolean' ||
        (typeof entry.value === 'number' && Number.isFinite(entry.value))
      ) {
        this.#defineCloneValue(frame.target, entry.key, entry.value);
        continue;
      }
      if (typeof entry.value !== 'object') {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }
      if (active.has(entry.value)) {
        throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
      }

      const existing = clones.get(entry.value);
      if (existing !== undefined) {
        this.#defineCloneValue(frame.target, entry.key, existing);
        continue;
      }

      const child: SerializedContainer = Array.isArray(entry.value) ? [] : {};
      const childFrame = this.#createCloneFrame(entry.value as SerializedContainer, child);

      clones.set(entry.value, child);
      active.add(entry.value);
      this.#defineCloneValue(frame.target, entry.key, child);
      frames.push(childFrame);
    }

    return root;
  }

  #createCloneFrame(
    source: SerializedContainer,
    target: SerializedContainer,
  ): SerializedCloneFrame {
    const entries: SerializedCloneEntry[] = [];

    if (Array.isArray(source)) {
      this.#assertOrdinaryArray(source);
      for (let index = 0; index < source.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
        if (descriptor === undefined || !('value' in descriptor)) {
          throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
        }
        entries.push({key: String(index), value: descriptor.value});
      }
    } else {
      this.#readRecord(source);
      const descriptors = Object.getOwnPropertyDescriptors(source);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== 'string') {
          throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
        }

        const descriptor = descriptors[key];
        if (descriptor === undefined || !descriptor.enumerable) {
          continue;
        }
        if (!('value' in descriptor)) {
          throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
        }
        entries.push({key, value: descriptor.value});
      }
    }

    return {entries, index: 0, source, target};
  }

  #defineCloneValue(target: SerializedContainer, key: string, value: unknown): void {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  #readRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }

    return value as Record<string, unknown>;
  }

  #assertOrdinaryArray(value: unknown[]): void {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
  }

  #readOwnValue(record: Record<string, unknown>, key: string): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined) {
      return undefined;
    }
    if (!('value' in descriptor)) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    return descriptor.value;
  }

  #readString(record: Record<string, unknown>, key: string): string {
    const value = this.#readOwnValue(record, key);
    if (typeof value !== 'string') {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    return value;
  }

  #readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
    const value = this.#readOwnValue(record, key);
    if (value !== undefined && typeof value !== 'string') {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    return value;
  }

  #readNumber(record: Record<string, unknown>, key: string): number {
    const value = this.#readOwnValue(record, key);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    return value;
  }

  #readSeverity(record: Record<string, unknown>): Contract.ErrorSeverity {
    const severity = this.#readOwnValue(record, 'severity');
    if (severity !== 'recoverable' && severity !== 'fatal') {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    return severity;
  }

  #readTimestamp(record: Record<string, unknown>): string {
    const timestamp = this.#readString(record, 'timestamp');
    const match = ISO_8601_TIMESTAMP_PATTERN.exec(timestamp);

    if (match === null || Number.isNaN(Date.parse(timestamp))) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    const offsetHour = match[8] === 'Z' ? 0 : Number(match[9]);
    const offsetMinute = match[8] === 'Z' ? 0 : Number(match[10]);

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > this.#daysInMonth(year, month) ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      offsetHour > 23 ||
      offsetMinute > 59
    ) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }

    return timestamp;
  }

  #daysInMonth(year: number, month: number): number {
    if (month === 2) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
  }

  #enter(value: object): void {
    if (this.#active.has(value)) {
      throw new TypeError(INVALID_SERIALIZED_ERROR_MESSAGE);
    }
    this.#active.add(value);
  }
}
