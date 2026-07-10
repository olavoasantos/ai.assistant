import type {ServiceContainer} from '@ai.assistant/contracts/service-container';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {SERVICE_CONTAINER_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link ServiceContainer} instance.
 *
 * Uses the `Symbol.for('ai.assistant:ServiceContainer')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (ServiceContainerGuard.is(value)) {
 *   // value is narrowed to ServiceContainer
 *   value.ensure('Logger');
 * }
 * ```
 */
export const ServiceContainerGuard = createRule<unknown, ServiceContainer>({
  name: 'ServiceContainer',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      SERVICE_CONTAINER_IDENTIFIER in value &&
      value[SERVICE_CONTAINER_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as ServiceContainer);
    }

    return Err();
  },
});
