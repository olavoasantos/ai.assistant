import type {ValidationContext, ValidationOptions} from '@ai.assistant/contracts/validation';

/**
 * Internal options type used by the validation engine to thread context
 * through the `rule.validate(value, options)` API boundary.
 *
 * The public `ValidationOptions` contract is clean — these internal
 * fields exist only at the engine level and are never visible to
 * consumers.
 */
export interface InternalValidationOptions extends ValidationOptions {
  /** Pre-built context from a parent rule, used instead of creating a fresh one. */
  readonly _context?: ValidationContext;
  /** The parent validator's name, used for structured message key construction. */
  readonly _parentName?: string;
}
