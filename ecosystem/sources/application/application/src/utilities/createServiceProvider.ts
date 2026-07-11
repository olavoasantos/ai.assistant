import type {ServiceProvider} from '@ai.assistant/contracts/application';

/**
 * Create a service-provider factory while preserving its literal name and arguments.
 *
 * @param definition - A fixed provider definition or a provider-producing factory.
 * @returns A factory that creates or returns the typed service provider.
 */
export function createServiceProvider<const Name extends string, Args extends unknown[] = []>(
  factory: (...args: Args) => ServiceProvider<Name>,
): (...args: Args) => ServiceProvider<Name>;
export function createServiceProvider<const Name extends string>(
  definition: ServiceProvider<Name>,
): () => ServiceProvider<Name>;
export function createServiceProvider<const Name extends string, Args extends unknown[] = []>(
  definitionOrFactory: ServiceProvider<Name> | ((...args: Args) => ServiceProvider<Name>),
): (...args: Args) => ServiceProvider<Name> {
  return typeof definitionOrFactory === 'function'
    ? definitionOrFactory
    : () => definitionOrFactory;
}
