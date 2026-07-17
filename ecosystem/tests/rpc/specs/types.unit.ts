import {describe, expectTypeOf, it} from 'vitest';
import type {
  RpcAdversarialTransportFactory,
  RpcComplianceTestSuite,
  RpcProtocolVector,
  RpcProtocolVectorAdapter,
  RpcTestClientFactory,
  RpcTestNodeFactory,
  RpcTestPluginFactory,
  RpcTestScheduler,
  RpcTestServerFactory,
  RpcTestSessionFactory,
  RpcTestSessionInspector,
  RpcTestSessionSnapshot,
  RpcTestTelemetryFactory,
} from '../types';

function verifyReadonly(snapshot: RpcTestSessionSnapshot): void {
  // @ts-expect-error Compliance snapshots are immutable observations.
  snapshot.phase = 'active';
  // @ts-expect-error Authority counters cannot be mutated through inspection.
  snapshot.authority.issued = 1;
}

describe('RPC compliance framework types', () => {
  it('requires every endpoint, session, transport, telemetry, plugin, and inspection capability', () => {
    expectTypeOf<RpcComplianceTestSuite['createServer']>().toEqualTypeOf<RpcTestServerFactory>();
    expectTypeOf<RpcComplianceTestSuite['createClient']>().toEqualTypeOf<RpcTestClientFactory>();
    expectTypeOf<RpcComplianceTestSuite['createNode']>().toEqualTypeOf<RpcTestNodeFactory>();
    expectTypeOf<RpcComplianceTestSuite['createSession']>().toEqualTypeOf<RpcTestSessionFactory>();
    expectTypeOf<
      RpcComplianceTestSuite['createTransportPair']
    >().toEqualTypeOf<RpcAdversarialTransportFactory>();
    expectTypeOf<
      RpcComplianceTestSuite['createTelemetry']
    >().toEqualTypeOf<RpcTestTelemetryFactory>();
    expectTypeOf<RpcComplianceTestSuite['createPlugin']>().toEqualTypeOf<RpcTestPluginFactory>();
    expectTypeOf<
      ReturnType<RpcComplianceTestSuite['createScheduler']>
    >().toEqualTypeOf<RpcTestScheduler>();
    expectTypeOf<
      RpcComplianceTestSuite['sessionInspector']
    >().toEqualTypeOf<RpcTestSessionInspector>();
  });

  it('keeps normalized session inspection immutable and source-neutral', () => {
    expectTypeOf<RpcTestSessionSnapshot['phase']>().toEqualTypeOf<
      | 'construction'
      | 'admission'
      | 'compatibility'
      | 'root-delivery'
      | 'active'
      | 'disposing'
      | 'disposed'
      | 'rejected'
    >();
    expectTypeOf<RpcTestSessionSnapshot['authority']>().toEqualTypeOf<
      Readonly<{issued: number; received: number}>
    >();

    expectTypeOf(verifyReadonly).toBeFunction();
  });

  it('exposes deterministic mechanical fault controls below public transports', () => {
    type Control = ReturnType<RpcAdversarialTransportFactory>['control'];

    expectTypeOf<Control['releaseReady']>().toBeCallableWith('server');
    expectTypeOf<Control['holdSends']>().toBeCallableWith('client');
    expectTypeOf<Control['deliverNext']>().toBeCallableWith('server-to-client');
    expectTypeOf<Control['dropNext']>().toBeCallableWith('client-to-server');
    expectTypeOf<Control['duplicateNext']>().toBeCallableWith('server-to-client');
    expectTypeOf<Control['reorder']>().toBeCallableWith('server-to-client', 1, 0);
    expectTypeOf<Control['inject']>().toBeCallableWith('server', {
      frame: 'malformed',
      context: undefined,
    });
    expectTypeOf<Control['error']>().toBeCallableWith('server', new Error('failure'));
    expectTypeOf<Control['close']>().toBeCallableWith('client');
  });

  it('keeps canonical vectors generic over future message and representation types', () => {
    interface CanonicalCall {
      readonly family: 'call';
      readonly correlation: number;
    }

    type Vector = RpcProtocolVector<CanonicalCall, string, {readonly kind: 'call'}>;
    type Adapter = RpcProtocolVectorAdapter<CanonicalCall, string>;

    expectTypeOf<Vector['canonical']>().toEqualTypeOf<CanonicalCall>();
    expectTypeOf<Vector['string']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Vector['raw']>().toEqualTypeOf<{readonly kind: 'call'} | undefined>();
    expectTypeOf<ReturnType<Adapter['encode']>>().toEqualTypeOf<string>();
    expectTypeOf<ReturnType<Adapter['decode']>>().toEqualTypeOf<CanonicalCall>();
  });
});
