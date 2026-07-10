import type {FailureResult} from '@ai.assistant/contracts/validation';
import {ApplicationError, ErrorIssue} from '@ai.assistant/error';

/**
 * Convert a validation failure result into an `ApplicationError` and throw it.
 *
 * Each validation issue is attached as an `ErrorIssue`. Path segments
 * that are `StandardSchemaV1.PathSegment` objects are normalized to
 * plain `PropertyKey` values by extracting the `.key` field.
 *
 * @param result - The failure result from a `.validate()` call.
 * @throws ApplicationError always.
 */
export function throwValidationError(result: FailureResult): never {
  const error = new ApplicationError({
    message: 'Validation failed',
    code: 400,
    severity: 'recoverable',
  });
  for (const issue of result.issues) {
    const path = issue.path?.map((segment) =>
      typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment,
    );
    error.add(new ErrorIssue({message: issue.message, path}));
  }
  throw error;
}
