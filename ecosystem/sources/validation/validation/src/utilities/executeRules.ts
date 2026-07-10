import type {Issue, Result, Rule, ValidationContext} from '@ai.assistant/contracts/validation';
import type {InternalValidationOptions} from '../types';

/**
 * Execute a sequence of rules against a value, threading the output of
 * each successful rule into the next.
 *
 * Issues from failing rules are accumulated. When `options.bail` is `true`,
 * execution stops at the first failure. Returns a {@link Result} reflecting
 * the aggregate outcome.
 *
 * @template T - The value type being validated.
 * @param value - The current value to validate against each rule.
 * @param rules - Rules to execute in order. Should be pre-sorted via `sortRulesByPhase`.
 * @param context - The validation context for this execution pass.
 * @param parentName - The parent validator's name, used for structured message keys on sub-rule issues.
 * @returns A success result with the final value, or a failure result with all accumulated issues.
 */
export function executeRules<T>(
  value: T,
  rules: readonly Rule<T>[],
  context: ValidationContext,
  parentName: string,
): Result<T> {
  if (rules.length === 0) {
    return {ok: true, value, issues: undefined};
  }

  let currentValue = value;
  const allIssues: Issue[] = [];
  const internalOptions: InternalValidationOptions = {
    ...context.options,
    _context: context,
    _parentName: parentName,
  };

  for (const rule of rules) {
    const result = rule.validate(currentValue, internalOptions);

    if (result.ok) {
      currentValue = result.value;
    } else {
      allIssues.push(...result.issues);
      if (context.options.bail) break;
    }
  }

  if (allIssues.length > 0) {
    return {ok: false, value: undefined, issues: allIssues};
  }

  return {ok: true, value: currentValue, issues: undefined};
}
