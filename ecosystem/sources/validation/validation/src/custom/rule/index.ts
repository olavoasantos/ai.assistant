import type {StandardSchemaV1} from '@standard-schema/spec';
import type {
  Meta,
  Result,
  Rule,
  RuleDescriptor,
  SuccessResult,
  UpdatableMetaOptions,
  ValidationContext,
  ValidationOptions,
} from '@ai.assistant/contracts/validation';
import type {InternalValidationOptions} from '../../types';
import {sortRulesByPhase} from '../../utilities/sortRulesByPhase';
import {executeRules} from '../../utilities/executeRules';
import {enrichIssue} from '../../utilities/enrichIssue';
import {createValidationContext} from '../../utilities/createValidationContext';
import {throwValidationError} from '../../utilities/throwValidationError';

/**
 * Create a callable validator from a rule descriptor.
 *
 * This is the single foundational primitive from which all validators,
 * rules, and combinators in the library are built. The returned
 * {@link Rule} is a callable object — invoking it directly aliases
 * `.validate()`.
 *
 * The execution pipeline per validation call is:
 * 1. `descriptor.validate()` — the type-level or foundational check.
 * 2. Sub-rules — sorted by order: `pre` → `default` → `post`.
 * 3. `descriptor.traverse()` — if present, descends into children.
 *
 * If any step fails, subsequent steps are skipped and a failure
 * result is returned.
 *
 * @template Input - The expected input type.
 * @template Output - The validated/transformed output type.
 * @param descriptor - Configuration defining the rule's behavior,
 *   identity, and composition.
 * @returns A callable {@link Rule} with `.validate()`, `.ensureValid()`,
 *   `.parse()`, `.ensureParse()`, `.set()`, `.setMany()`, `.optional()`,
 *   and `~standard` conformance.
 */
export function createRule<Input = unknown, Output = Input>(
  descriptor: RuleDescriptor<Input, Output>,
): Rule<Input, Output> {
  const order = descriptor.order ?? 'default';
  const meta: Meta = {name: descriptor.name, ...descriptor.meta};
  const sortedRules = descriptor.rules ? sortRulesByPhase(descriptor.rules) : [];

  function validate(value: unknown, callSiteOptions?: ValidationOptions): Result<Output> {
    const internal = callSiteOptions as InternalValidationOptions | undefined;
    const mergedOptions: ValidationOptions = {...descriptor.options, ...callSiteOptions};
    const parentName = internal?._parentName;

    const context: ValidationContext =
      internal?._context ?? createValidationContext(value, mergedOptions);

    const ruleResult = descriptor.validate(value as Input, context);

    if (!ruleResult.ok) {
      const issues = (ruleResult.issues ?? [{}]).map((partial) =>
        enrichIssue(partial, descriptor, parentName, mergedOptions),
      );
      return {ok: false, value: undefined, issues};
    }

    let output = ('value' in ruleResult ? ruleResult.value : value) as Output;

    if (sortedRules.length > 0) {
      const subResult = executeRules(output, sortedRules, context, descriptor.name);
      if (!subResult.ok) return subResult;
      output = subResult.value;
    }

    if (descriptor.traverse) {
      const traverseResult = descriptor.traverse(output, context);
      if (!traverseResult.ok) return traverseResult;
      output = traverseResult.value;
    }

    return {ok: true, value: output, issues: undefined};
  }

  const rule = validate as Rule<Input, Output>;

  Object.assign(rule, {
    validate,

    ensureValid(value: unknown, callSiteOptions?: ValidationOptions): SuccessResult<Output> {
      const result = validate(value, callSiteOptions);
      if (result.ok) return result;
      throwValidationError(result);
    },

    parse(value: unknown, callSiteOptions?: ValidationOptions): Output | undefined {
      const result = validate(value, callSiteOptions);
      return result.ok ? result.value : undefined;
    },

    ensureParse(value: unknown, callSiteOptions?: ValidationOptions): Output {
      const result = validate(value, callSiteOptions);
      if (result.ok) return result.value;
      throwValidationError(result);
    },

    set<Key extends keyof UpdatableMetaOptions>(
      key: Key,
      metaValue: UpdatableMetaOptions[Key],
    ): Rule<Input, Output> {
      (meta as any)[key] = metaValue;
      return rule;
    },

    setMany(options: Partial<UpdatableMetaOptions>): Rule<Input, Output> {
      Object.assign(meta, options);
      return rule;
    },

    is(maybe: Input): maybe is Input & Output {
      return validate(maybe).ok;
    },

    optional(defaultValue?: Input) {
      return createRule<Input | undefined, Output | undefined>({
        name: descriptor.name,
        order: descriptor.order,
        extras: descriptor.extras,
        meta: {...meta},
        options: descriptor.options,
        validate(value, context) {
          const check = value !== undefined ? value : defaultValue;
          if (check === undefined) return {ok: true, value: undefined};
          const innerOptions: InternalValidationOptions = {
            ...context.options,
            _context: context,
          };
          const innerResult = rule.validate(check, innerOptions);
          if (innerResult.ok) return {ok: true, value: innerResult.value};
          return innerResult as any;
        },
      });
    },

    order,

    meta,

    '~standard': {
      version: 1 as const,
      vendor: 'ai.assistant',
      validate(value: Input): StandardSchemaV1.Result<Output> {
        const result = validate(value);
        if (result.ok) return {value: result.value};
        return {
          issues: result.issues.map((issue) => ({
            message: issue.message,
            path: issue.path,
          })),
        };
      },
    },
  });

  return rule;
}
