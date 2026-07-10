import type {ErrResult, IssueDescriptor} from '@ai.assistant/contracts/validation';

/**
 * Create a failure result from within a rule's `validate` function.
 *
 * - `Err()` — fail with a single default issue. The engine generates a
 *   structured message key from the rule name and parent context
 *   (e.g. `'validation.string.minLength'`).
 * - `Err(issue1, issue2, ...)` — fail with explicit issues. Each
 *   {@link IssueDescriptor} is forwarded to the engine for enrichment
 *   into a full {@link Issue}.
 *
 * @param issues - Zero or more issue descriptors. When omitted, a single
 *   default issue is generated.
 * @returns An {@link ErrResult} with `ok: false`.
 */
export function Err(...issues: IssueDescriptor[]): ErrResult {
  return issues.length === 0 ? {ok: false} : {ok: false, issues};
}
