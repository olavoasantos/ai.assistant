import type {Rule} from '@ai.assistant/contracts/validation';

/**
 * Sort rules by their execution phase: `pre` → `default` → `post`.
 *
 * Returns a new array — the input is not mutated. Rules within the same
 * phase retain their relative order (stable sort).
 *
 * @template T - The value type the rules operate on.
 * @param rules - Rules to sort.
 * @returns A new sorted array.
 */
export function sortRulesByPhase<T>(rules: readonly Rule<T>[]): readonly Rule<T>[] {
  const phaseOrder = {pre: 0, default: 1, post: 2} as const;
  return [...rules].toSorted((a, b) => phaseOrder[a.order] - phaseOrder[b.order]);
}
