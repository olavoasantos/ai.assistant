import type {Rule} from '@ai.assistant/contracts/validation';

/**
 * Determines whether a given value is a validation rule.
 *
 * Performs a runtime structural check to identify validators by the
 * presence of a `~standard` property. Primarily used internally to
 * disambiguate overloaded arguments.
 *
 * @param value - The candidate value to evaluate.
 * @returns `true` if the value matches the Rule signature.
 */
export function isRule(value: unknown): value is Rule<any, any> {
  return (
    (typeof value === 'function' || typeof value === 'object') &&
    value !== null &&
    '~standard' in value
  );
}
