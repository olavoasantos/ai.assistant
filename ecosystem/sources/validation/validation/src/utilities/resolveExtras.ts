import type {RuleDescriptor, RuleExtras} from '@ai.assistant/contracts/validation';

/**
 * Resolve the extras from a rule descriptor into a plain object.
 *
 * Extras can be either a static object or a factory function. This
 * utility normalizes both forms into a plain `RuleExtras` object.
 * Returns an empty object when no extras are defined.
 *
 * @param descriptor - The rule descriptor containing optional extras.
 * @returns A resolved plain extras object.
 */
export function resolveExtras(descriptor: Pick<RuleDescriptor, 'extras'>): RuleExtras {
  if (descriptor.extras === undefined) {
    return {};
  }

  return typeof descriptor.extras === 'function' ? descriptor.extras() : descriptor.extras;
}
