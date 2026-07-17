/** Symbol brand identifying {@link ApplicationError} instances across module boundaries. */
export const APPLICATION_ERROR_IDENTIFIER = Symbol.for('ai.assistant:ApplicationError');

/** Default maximum depth for serialized error reconstruction. */
export const DEFAULT_ERROR_DESERIALIZATION_DEPTH = 5;

/** Safe message used when untrusted serialized error input is rejected. */
export const INVALID_SERIALIZED_ERROR_MESSAGE = 'Cannot deserialize application error.';

/** Accepted ISO 8601 timestamp representation for serialized errors. */
export const ISO_8601_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/;

/** Symbol brand identifying {@link ErrorIssue} instances across module boundaries. */
export const ERROR_ISSUE_IDENTIFIER = Symbol.for('ai.assistant:ErrorIssue');
