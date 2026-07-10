import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {TELEMETRY_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link Telemetry} instance.
 *
 * Uses the `Symbol.for('ai.assistant:Telemetry')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (TelemetryGuard.is(value)) {
 *   // value is narrowed to Telemetry
 *   value.startTimer('operation');
 * }
 * ```
 */
export const TelemetryGuard = createRule<unknown, Telemetry>({
  name: 'Telemetry',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      TELEMETRY_IDENTIFIER in value &&
      value[TELEMETRY_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Telemetry);
    }

    return Err();
  },
});
