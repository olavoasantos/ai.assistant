import type {
  Issue,
  IssueDescriptor,
  RuleDescriptor,
  RuleExtras,
  ValidationOptions,
} from '@ai.assistant/contracts/validation';
import {resolveExtras} from './resolveExtras';

/**
 * Enrich a partial issue descriptor into a complete issue.
 *
 * Builds a structured message key from the rule name and optional parent
 * name (e.g. `'validation.string.minLength'`), merges extras from the
 * descriptor and the issue, and applies any custom message override
 * from options.
 *
 * @param issue - Partial issue from a rule's `Err()` return.
 * @param descriptor - The rule descriptor that produced the issue.
 * @param parentName - The parent validator's name, if this is a sub-rule.
 * @param options - Merged validation options for custom message overrides.
 * @returns A fully-formed issue.
 */
export function enrichIssue(
  issue: Partial<IssueDescriptor>,
  descriptor: Pick<RuleDescriptor, 'name' | 'extras'>,
  parentName: string | undefined,
  options: ValidationOptions,
): Issue {
  const defaultMessage = parentName
    ? `validation.${parentName}.${descriptor.name}`
    : `validation.${descriptor.name}`;

  const descriptorExtras = resolveExtras(descriptor);
  const extras: RuleExtras | undefined =
    issue.extras !== undefined || Object.keys(descriptorExtras).length > 0
      ? {...descriptorExtras, ...issue.extras}
      : undefined;

  const enriched = issue as Partial<Issue>;

  return {
    message: options.message ?? issue.message ?? defaultMessage,
    rule: enriched.rule ?? descriptor.name,
    ...(enriched.path !== undefined && {path: enriched.path}),
    ...(extras !== undefined && {extras}),
  };
}
