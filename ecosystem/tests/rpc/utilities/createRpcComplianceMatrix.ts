import type {RpcComplianceMatrixOptions, RpcComplianceMatrixRow} from '../types';

/**
 * Builds a reusable cross-product of value, ownership, and representation cases.
 *
 * @template Value - Fixture data carried by each value-family case.
 * @param options - Matrix dimensions and optional inclusion predicate.
 * @returns Fresh immutable-by-contract rows in deterministic input order.
 */
export function createRpcComplianceMatrix<Value>(
  options: RpcComplianceMatrixOptions<Value>,
): RpcComplianceMatrixRow<Value>[] {
  let rows: RpcComplianceMatrixRow<Value>[] = [];

  for (let value of options.values) {
    for (let direction of options.directions) {
      for (let representation of options.representations) {
        let row: RpcComplianceMatrixRow<Value> = {
          name: value.name,
          promise: options.promise,
          phase: options.phase,
          direction,
          valueFamily: value.family,
          representation,
          variant: value.variant,
          value: value.value,
        };

        if (options.include === undefined || options.include(row)) {
          rows.push(row);
        }
      }
    }
  }

  return rows;
}
