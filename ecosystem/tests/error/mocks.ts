import {vi} from 'vitest';
import type * as Contract from '@ai.assistant/contracts/error';

/**
 * Mock implementation of the application error contract for tests that only
 * need a spyable contract object.
 */
export class MockApplicationError extends Error implements Contract.ApplicationError {
  code: number = 500;
  severity: Contract.ErrorSeverity = 'recoverable';
  reference?: string | undefined;
  metadata: Contract.ErrorMetadata = {};
  timestamp: string = new Date().toISOString();
  issues: readonly Contract.ErrorIssue[] = [];
  hasIssues: boolean = false;

  add: (issue: Error | Contract.ErrorIssue) => this = vi.fn(
    (_issue: Error | Contract.ErrorIssue) => {
      throw new Error('Method not implemented.');
    },
  ) as (issue: Error | Contract.ErrorIssue) => this;

  addMany: (issues: readonly (Error | Contract.ErrorIssue)[]) => this = vi.fn(
    (_issues: readonly (Error | Contract.ErrorIssue)[]) => {
      throw new Error('Method not implemented.');
    },
  ) as (issues: readonly (Error | Contract.ErrorIssue)[]) => this;

  set: <Key extends keyof Contract.UpdatableErrorOptions>(
    key: Key,
    value: Contract.UpdatableErrorOptions[Key],
  ) => this = vi.fn(
    <Key extends keyof Contract.UpdatableErrorOptions>(
      _key: Key,
      _value: Contract.UpdatableErrorOptions[Key],
    ) => {
      throw new Error('Method not implemented.');
    },
  ) as <Key extends keyof Contract.UpdatableErrorOptions>(
    key: Key,
    value: Contract.UpdatableErrorOptions[Key],
  ) => this;

  setMany: (options: Partial<Contract.UpdatableErrorOptions>) => this = vi.fn(
    (_options: Partial<Contract.UpdatableErrorOptions>) => {
      throw new Error('Method not implemented.');
    },
  ) as (options: Partial<Contract.UpdatableErrorOptions>) => this;

  removeAll: () => this = vi.fn(() => {
    throw new Error('Method not implemented.');
  }) as () => this;

  toJSON: Contract.ApplicationError['toJSON'] = vi.fn(
    (_options?: Contract.ErrorSerializerOptions) => {
      throw new Error('Method not implemented.');
    },
  ) as Contract.ApplicationError['toJSON'];

  /** Creates a mock application error. */
  constructor(message: string = 'An error occurred') {
    super(message);
    this.name = 'MockApplicationError';
  }
}
