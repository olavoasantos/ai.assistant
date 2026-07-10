import type {PluginRunner} from '@ai.assistant/contracts/plugins';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {PLUGIN_RUNNER_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link PluginRunner} instance.
 *
 * Uses the `Symbol.for('ai.assistant:PluginRunner')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (PluginRunnerGuard.is(value)) {
 *   // value is narrowed to PluginRunner
 *   value.trigger({ hook: 'boot', args: [] });
 * }
 * ```
 */
export const PluginRunnerGuard = createRule<unknown, PluginRunner>({
  name: 'PluginRunner',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      PLUGIN_RUNNER_IDENTIFIER in value &&
      value[PLUGIN_RUNNER_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as PluginRunner);
    }

    return Err();
  },
});
