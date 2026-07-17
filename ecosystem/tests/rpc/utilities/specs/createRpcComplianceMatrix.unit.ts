import {describe, expect, it} from 'vitest';
import type {RpcComplianceValueCase, RpcTestOwnershipDirection} from '../../types';
import {createRpcComplianceMatrix} from '../createRpcComplianceMatrix';

describe('createRpcComplianceMatrix', () => {
  it('builds a deterministic value, direction, and representation cross-product', () => {
    let values: RpcComplianceValueCase<{kind: string}>[] = [
      {name: 'plain', family: 'copy', value: {kind: 'plain'}},
      {name: 'callback', family: 'function', value: {kind: 'callback'}},
    ];

    let rows = createRpcComplianceMatrix({
      promise: 'crosses values',
      phase: 'active',
      values,
      directions: ['server-to-client', 'client-to-server'],
      representations: ['string', 'raw'],
    });

    expect(rows).toHaveLength(8);
    expect(rows.map((row) => `${row.name}:${row.direction}:${row.representation}`)).toEqual([
      'plain:server-to-client:string',
      'plain:server-to-client:raw',
      'plain:client-to-server:string',
      'plain:client-to-server:raw',
      'callback:server-to-client:string',
      'callback:server-to-client:raw',
      'callback:client-to-server:string',
      'callback:client-to-server:raw',
    ]);
    expect(rows[0]).toMatchObject({
      promise: 'crosses values',
      phase: 'active',
      valueFamily: 'copy',
      value: {kind: 'plain'},
    });
  });

  it('filters semantically invalid combinations', () => {
    let rows = createRpcComplianceMatrix({
      promise: 'crosses streams',
      phase: 'active',
      values: [{name: 'stream', family: 'stream', value: 'stream'}],
      directions: ['server-to-client', 'client-to-server'],
      representations: ['string', 'raw'],
      include: (row) => row.direction === 'server-to-client' || row.representation === 'raw',
    });

    expect(rows.map((row) => `${row.direction}:${row.representation}`)).toEqual([
      'server-to-client:string',
      'server-to-client:raw',
      'client-to-server:raw',
    ]);
  });

  it('returns no rows for an empty dimension without mutating inputs', () => {
    let values: RpcComplianceValueCase<{nested: boolean}>[] = [
      {name: 'plain', family: 'copy', value: {nested: true}},
    ];
    let directions: RpcTestOwnershipDirection[] = ['server-to-client'];

    let rows = createRpcComplianceMatrix({
      promise: 'crosses values',
      phase: 'active',
      values,
      directions,
      representations: [],
    });

    expect(rows).toEqual([]);
    expect(values).toEqual([{name: 'plain', family: 'copy', value: {nested: true}}]);
    expect(directions).toEqual(['server-to-client']);
  });
});
