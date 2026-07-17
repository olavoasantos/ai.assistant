import type * as Contract from '@ai.assistant/contracts/error';

/** Constructs a concrete application error from contract options. */
export interface ApplicationErrorConstructor<ErrorType extends Contract.ApplicationError> {
  new (options: Contract.ErrorOptions): ErrorType;
}

/** Constructs a concrete error issue from contract options. */
export interface ErrorIssueConstructor<IssueType extends Contract.ErrorIssue> {
  new (options: Contract.ErrorIssueOptions): IssueType;
}

/** Internal contract for strict serialized-error parsers. */
export interface SerializedErrorParserContract<ErrorType extends Contract.ApplicationError> {
  /** Reconstructs a fresh application error or throws a safe application error. */
  parse(value: unknown): ErrorType;
}

/** Plain container accepted while cloning serialized metadata. */
export type SerializedContainer = Record<string, unknown> | unknown[];

/** One own serialized value awaiting a defensive copy. */
export interface SerializedCloneEntry {
  readonly key: string;
  readonly value: unknown;
}

/** One active depth-first frame in the iterative metadata cloner. */
export interface SerializedCloneFrame {
  readonly source: SerializedContainer;
  readonly target: SerializedContainer;
  readonly entries: readonly SerializedCloneEntry[];
  index: number;
}
