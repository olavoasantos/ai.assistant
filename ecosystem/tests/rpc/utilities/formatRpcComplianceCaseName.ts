import type {RpcComplianceCaseDescriptor} from '../types';

/**
 * Formats one metadata-rich RPC compliance case name.
 *
 * @param descriptor - Behavioral promise and matrix dimensions to identify.
 * @returns A deterministic name suitable for test-runner failure output.
 */
export function formatRpcComplianceCaseName(descriptor: RpcComplianceCaseDescriptor): string {
  let parts = [
    descriptor.promise,
    `phase=${descriptor.phase}`,
    `direction=${descriptor.direction}`,
    `valueFamily=${descriptor.valueFamily}`,
  ];

  if (descriptor.representation !== undefined) {
    parts.push(`representation=${descriptor.representation}`);
  }

  if (descriptor.variant !== undefined) {
    parts.push(`variant=${descriptor.variant}`);
  }

  return parts.join(' | ');
}
