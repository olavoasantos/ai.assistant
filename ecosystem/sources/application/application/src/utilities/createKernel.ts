import type {Kernel} from '@ai.assistant/contracts/application';

/**
 * Create a kernel factory while preserving its literal name and arguments.
 *
 * @param definition - A fixed kernel definition or a kernel-producing factory.
 * @returns A factory that creates or returns the typed kernel.
 */
export function createKernel<const Name extends string, Args extends unknown[] = []>(
  factory: (...args: Args) => Kernel<Name>,
): (...args: Args) => Kernel<Name>;
export function createKernel<const Name extends string>(
  definition: Kernel<Name>,
): () => Kernel<Name>;
export function createKernel<const Name extends string, Args extends unknown[] = []>(
  definitionOrFactory: Kernel<Name> | ((...args: Args) => Kernel<Name>),
): (...args: Args) => Kernel<Name> {
  return typeof definitionOrFactory === 'function'
    ? definitionOrFactory
    : () => definitionOrFactory;
}
