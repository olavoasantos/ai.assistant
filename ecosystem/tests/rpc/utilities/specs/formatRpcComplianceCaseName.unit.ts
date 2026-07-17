import {describe, expect, it} from 'vitest';
import {formatRpcComplianceCaseName} from '../formatRpcComplianceCaseName';

describe('formatRpcComplianceCaseName', () => {
  it('identifies the behavioral promise, lifecycle phase, direction, and value family', () => {
    expect(
      formatRpcComplianceCaseName({
        promise: 'preserves identity',
        phase: 'active',
        direction: 'server-to-client',
        valueFamily: 'object',
      }),
    ).toBe('preserves identity | phase=active | direction=server-to-client | valueFamily=object');
  });

  it('adds representation and variant dimensions in stable order', () => {
    expect(
      formatRpcComplianceCaseName({
        promise: 'reclaims authority',
        phase: 'disposed',
        direction: 'round-trip',
        valueFamily: 'function',
        representation: 'raw',
        variant: 'close-race',
      }),
    ).toBe(
      'reclaims authority | phase=disposed | direction=round-trip | valueFamily=function | representation=raw | variant=close-race',
    );
  });
});
