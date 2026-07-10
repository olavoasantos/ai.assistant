import type {PluginContainer} from '@ai.assistant/contracts/plugins';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {PLUGIN_CONTAINER_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link PluginContainer} instance.
 *
 * Uses the `Symbol.for('ai.assistant:PluginContainer')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (PluginContainerGuard.is(value)) {
 *   // value is narrowed to PluginContainer
 *   container.add(myPlugin);
 * }
 * ```
 */
export const PluginContainerGuard = createRule<unknown, PluginContainer>({
  name: 'PluginContainer',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      PLUGIN_CONTAINER_IDENTIFIER in value &&
      value[PLUGIN_CONTAINER_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as PluginContainer);
    }

    return Err();
  },
});
