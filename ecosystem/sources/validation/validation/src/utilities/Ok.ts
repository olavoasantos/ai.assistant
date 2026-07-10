import type {OkResult} from '@ai.assistant/contracts/validation';

/**
 * Create a success result from within a rule's `validate` function.
 *
 * - `Ok()` — pass, keep the current value as-is.
 * - `Ok(newValue)` — pass and transform: the engine replaces the current
 *   value with `newValue`. This is how transform rules (e.g. `trim()`,
 *   `lowercase()`) express their output.
 *
 * @returns An {@link OkResult} with `ok: true`.
 */
export function Ok<Output>(): OkResult<Output>;
/**
 * Create a success result that transforms the value.
 *
 * @template Output - The type of the transformed value.
 * @param value - The new value to replace the current one.
 * @returns An {@link OkResult} with `ok: true` and the provided value.
 */
export function Ok<Output>(value: Output): OkResult<Output>;
export function Ok<Output>(value?: Output): OkResult<Output> {
  return arguments.length === 0 ? {ok: true} : {ok: true, value};
}
