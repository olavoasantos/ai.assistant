/**
 * A reactive value container that notifies subscribers when its value changes.
 *
 * @template T - The type of the value held by the signal.
 */
export type {Signal} from '@preact/signals-core';

/**
 * A read-only view of a reactive signal that prevents direct mutation.
 *
 * Exposes the current value and allows subscriptions. Data sources and
 * computed state use this type to enforce unidirectional data flow.
 *
 * @template T - The type of the value held by the signal.
 */
export type {ReadonlySignal} from '@preact/signals-core';
