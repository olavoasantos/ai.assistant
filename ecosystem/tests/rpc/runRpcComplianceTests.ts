import {describe, expect, expectTypeOf, it} from 'vitest';
import {
  RPC_TEST_CORE_BUDGET_CATEGORIES,
  RPC_TEST_SESSION_MAX_STEPS,
  RPC_TEST_TRANSPORT_OWNERSHIPS,
  RPC_TEST_TRANSPORT_REPRESENTATIONS,
} from './constants';
import type {RpcComplianceClientApi, RpcComplianceServerApi, RpcComplianceTestSuite} from './types';
import {formatRpcComplianceCaseName} from './utilities/formatRpcComplianceCaseName';

/**
 * Registers the shared foundation tests every RPC implementation must satisfy.
 *
 * The suite verifies public endpoint and session behavior while using
 * privileged controls only for transport mechanics and source-neutral cleanup
 * observations. Exact frames, identifiers, registries, and implementation
 * classes remain outside shared compliance.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 * @param factories - Complete implementation factories and test capabilities.
 */
export function runRpcComplianceTests<Frame, Context>(
  factories: RpcComplianceTestSuite<Frame, Context>,
): void {
  describe('RPC foundation compliance', () => {
    it(
      formatRpcComplianceCaseName({
        promise: 'constructs endpoints without implicit sessions or traffic',
        phase: 'construction',
        direction: 'not-applicable',
        valueFamily: 'root',
      }),
      async () => {
        let scheduler = factories.createScheduler();
        let transport = factories.createTransportPair({representation: 'raw', scheduler});
        let telemetry = factories.createTelemetry({namespace: 'rpc.compliance'});
        let plugin = factories.createPlugin({name: 'compliance-observer'});
        let server = factories.createServer<RpcComplianceClientApi, RpcComplianceServerApi>({
          telemetry,
          plugins: [plugin],
        });
        let client = factories.createClient<RpcComplianceServerApi, RpcComplianceClientApi>();
        let node = factories.createNode<RpcComplianceServerApi, RpcComplianceClientApi>();

        try {
          expect(server.sessions.size).toBe(0);
          expect(server.node.sessions.size).toBe(0);
          expect(client.session).toBeUndefined();
          expect(client.node.sessions.size).toBe(0);
          expect(node.sessions.size).toBe(0);
          expect(() => client.root).toThrow();
          expect(transport.control.snapshot.queued).toHaveLength(0);
          expect(transport.control.snapshot.subscriptions).toEqual({server: 0, client: 0});
          expect(plugin.name).toBe('compliance-observer');
        } finally {
          await Promise.all([server.dispose(), client.dispose(), node.dispose()]);
          await Promise.all([transport.server.dispose(), transport.client.dispose()]);
          telemetry.dispose();
        }
      },
    );

    for (let representation of RPC_TEST_TRANSPORT_REPRESENTATIONS) {
      describe(`${representation} representation`, () => {
        it(
          formatRpcComplianceCaseName({
            promise: 'requires explicit application admission before session traffic',
            phase: 'admission',
            direction: 'server-to-client',
            valueFamily: 'root',
            representation,
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });

            try {
              expect(fixture.server.sessions.size).toBe(0);
              expect(fixture.client.session).toBeUndefined();
              expect(fixture.transport.control.snapshot.queued).toHaveLength(0);
              expect(fixture.transport.control.snapshot.subscriptions).toEqual({
                server: 0,
                client: 0,
              });
              expect(() => fixture.client.root).toThrow();
            } finally {
              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'rejects cancelled admission without creating authority',
            phase: 'rejected',
            direction: 'round-trip',
            valueFamily: 'root',
            representation,
            variant: 'pre-aborted',
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit({signal: AbortSignal.abort('cancelled admission')});
            let admitted = expect(attempt.admitted).rejects.toBeDefined();
            let connected = expect(attempt.connected).rejects.toBeDefined();

            try {
              await fixture.scheduler.runUntilIdle();
              await Promise.all([admitted, connected]);

              let snapshot = factories.sessionInspector.inspect(attempt);
              expect(snapshot).toMatchObject({
                phase: 'rejected',
                compatible: false,
                rootIssued: false,
                authority: {issued: 0, received: 0},
              });
              expect(fixture.server.sessions.size).toBe(0);
              expect(fixture.client.session).toBeUndefined();
              expect(() => fixture.client.root).toThrow();
            } finally {
              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'establishes compatibility before issuing the root',
            phase: 'compatibility',
            direction: 'server-to-client',
            valueFamily: 'root',
            representation,
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit();

            try {
              fixture.transport.control.releaseReady('server');
              fixture.transport.control.releaseReady('client');
              await fixture.scheduler.runUntilIdle();

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                let snapshot = factories.sessionInspector.inspect(attempt);

                if (snapshot.compatible) {
                  break;
                }

                expect(snapshot.rootIssued).toBe(false);
                let delivery = fixture.transport.control.snapshot.queued[0];
                expect(
                  delivery,
                  'compatibility must make deterministic transport progress',
                ).toBeDefined();

                if (delivery === undefined) {
                  break;
                }

                await fixture.transport.control.deliverNext(delivery.direction);
                await fixture.scheduler.runUntilIdle();
              }

              let compatible = factories.sessionInspector.inspect(attempt);
              expect(compatible.compatible).toBe(true);
              expect(['compatibility', 'root-delivery', 'active']).toContain(compatible.phase);

              if (compatible.phase !== 'active') {
                expect(() => fixture.client.root).toThrow();
              }

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                let snapshot = factories.sessionInspector.inspect(attempt);

                if (snapshot.phase === 'active') {
                  break;
                }

                let delivery = fixture.transport.control.snapshot.queued[0];
                expect(
                  delivery,
                  'root delivery must make deterministic transport progress',
                ).toBeDefined();

                if (delivery === undefined) {
                  break;
                }

                await fixture.transport.control.deliverNext(delivery.direction);
                await fixture.scheduler.runUntilIdle();
              }

              expect(
                factories.sessionInspector.inspect(attempt).phase,
                'root delivery did not converge within the deterministic step bound',
              ).toBe('active');
              let [serverSession, clientSession] = await Promise.all([
                attempt.admitted,
                attempt.connected,
              ]);
              expect(serverSession.status).toBe('active');
              expect(clientSession.status).toBe('active');
              expect(factories.sessionInspector.inspect(attempt)).toMatchObject({
                phase: 'active',
                compatible: true,
                rootIssued: true,
              });
            } finally {
              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'exposes typed asynchronous root calls after establishment',
            phase: 'active',
            direction: 'client-to-server',
            valueFamily: 'root',
            representation,
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit();

            try {
              fixture.transport.control.releaseReady('server');
              fixture.transport.control.releaseReady('client');

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();

                if (factories.sessionInspector.inspect(attempt).phase === 'active') {
                  break;
                }
              }

              expect(
                factories.sessionInspector.inspect(attempt).phase,
                'session establishment did not converge within the deterministic step bound',
              ).toBe('active');
              let connected = await attempt.connected;
              await attempt.admitted;
              expectTypeOf(connected.root.echo).returns.toEqualTypeOf<Promise<string>>();

              let result = connected.root.echo('foundation');

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();
              }

              await expect(result).resolves.toBe('foundation');
            } finally {
              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'negotiates complete finite session budgets',
            phase: 'active',
            direction: 'not-applicable',
            valueFamily: 'not-applicable',
            representation,
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit();

            try {
              fixture.transport.control.releaseReady('server');
              fixture.transport.control.releaseReady('client');

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();

                if (factories.sessionInspector.inspect(attempt).phase === 'active') {
                  break;
                }
              }

              expect(
                factories.sessionInspector.inspect(attempt).phase,
                'session establishment did not converge within the deterministic step bound',
              ).toBe('active');
              let [serverSession, clientSession] = await Promise.all([
                attempt.admitted,
                attempt.connected,
              ]);

              for (let session of [serverSession, clientSession]) {
                let limits = Object.values(session.compatibility.budget.core);
                let observations = Object.values(session.resources.core);
                expect(limits).toHaveLength(Object.keys(RPC_TEST_CORE_BUDGET_CATEGORIES).length);
                expect(observations).toHaveLength(
                  Object.keys(RPC_TEST_CORE_BUDGET_CATEGORIES).length,
                );
                expect(limits.every((limit) => Number.isSafeInteger(limit) && limit >= 0)).toBe(
                  true,
                );
                expect(
                  observations.every(
                    (observation) =>
                      Number.isSafeInteger(observation.limit) &&
                      observation.limit >= 0 &&
                      Number.isSafeInteger(observation.used) &&
                      observation.used >= 0 &&
                      observation.used <= observation.limit,
                  ),
                ).toBe(true);
              }
            } finally {
              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'rejects operations when finite call capacity is exhausted',
            phase: 'active',
            direction: 'client-to-server',
            valueFamily: 'root',
            representation,
            variant: 'calls.pending-exhausted',
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit();
            let exhausted = false;

            try {
              fixture.transport.control.releaseReady('server');
              fixture.transport.control.releaseReady('client');

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();

                if (factories.sessionInspector.inspect(attempt).phase === 'active') {
                  break;
                }
              }

              expect(
                factories.sessionInspector.inspect(attempt).phase,
                'session establishment did not converge within the deterministic step bound',
              ).toBe('active');
              let connected = await attempt.connected;
              await attempt.admitted;
              expect(fixture.budget.exhaust('calls.pending')).toEqual({
                category: 'calls.pending',
                disposition: 'reject-operation',
              });
              exhausted = true;
              let rejected = expect(connected.root.echo('over-capacity')).rejects.toBeDefined();

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();
              }

              await rejected;
              expect(factories.sessionInspector.inspect(attempt).phase).toBe('active');
            } finally {
              if (exhausted) {
                fixture.budget.restore();
              }

              await fixture.dispose();
            }
          },
        );

        it(
          formatRpcComplianceCaseName({
            promise: 'converges disconnect and transport close with complete cleanup',
            phase: 'disposing',
            direction: 'round-trip',
            valueFamily: 'root',
            representation,
            variant: 'close-race',
          }),
          async () => {
            let fixture = factories.createSession({
              serverRoot: {echo: (value) => value},
              clientRoot: {receive: () => undefined},
              representation,
            });
            let attempt = fixture.admit();

            try {
              fixture.transport.control.releaseReady('server');
              fixture.transport.control.releaseReady('client');

              for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();

                if (factories.sessionInspector.inspect(attempt).phase === 'active') {
                  break;
                }
              }

              expect(
                factories.sessionInspector.inspect(attempt).phase,
                'session establishment did not converge within the deterministic step bound',
              ).toBe('active');
              let [serverSession, clientSession] = await Promise.all([
                attempt.admitted,
                attempt.connected,
              ]);
              fixture.transport.control.holdSends('server');
              let pending = expect(clientSession.root.echo('late')).rejects.toBeDefined();
              await fixture.transport.control.deliverAll('client-to-server');
              let serverClosed = serverSession.closed;
              let clientClosed = clientSession.closed;
              let disconnect = clientSession.disconnect('compliance close race');
              fixture.transport.control.close('server', {reason: 'transport close race'});
              fixture.transport.control.rejectSends('server', new Error('transport closed'));
              await fixture.scheduler.runUntilIdle();
              await fixture.transport.control.deliverAll();

              await Promise.all([disconnect, serverClosed, clientClosed]);
              await pending;
              expect(serverSession.status).toBe('disposed');
              expect(clientSession.status).toBe('disposed');
              expect(serverSession.signal.aborted).toBe(true);
              expect(clientSession.signal.aborted).toBe(true);

              let snapshot = factories.sessionInspector.inspect(serverSession);
              expect(snapshot.phase).toBe('disposed');
              expect(snapshot.authority).toEqual({issued: 0, received: 0});
              expect(snapshot.pending).toEqual({
                calls: 0,
                notifications: 0,
                promises: 0,
                streams: 0,
                pluginMessages: 0,
              });
              expect(snapshot.transportSubscriptions).toBe(0);
              expect(snapshot.schedulerTasks).toBe(0);
              expect(snapshot.pluginState).toBe(0);

              expect(snapshot.resources).toBeDefined();

              if (snapshot.resources === undefined) {
                throw new Error('Disposed RPC session inspection omitted resource observations.');
              }

              expect(
                Object.values(snapshot.resources.core).every(
                  (observation) => observation.used === 0,
                ),
              ).toBe(true);
              expect(
                snapshot.resources.plugins.every((plugin) =>
                  Object.values(plugin.categories).every((observation) => observation.used === 0),
                ),
              ).toBe(true);
            } finally {
              await fixture.dispose();
            }
          },
        );

        for (let ownership of RPC_TEST_TRANSPORT_OWNERSHIPS) {
          it(
            formatRpcComplianceCaseName({
              promise: 'respects caller and RPC transport ownership during teardown',
              phase: 'disposed',
              direction: 'round-trip',
              valueFamily: 'not-applicable',
              representation,
              variant: `${ownership}-owned-transport`,
            }),
            async () => {
              let fixture = factories.createSession({
                serverRoot: {echo: (value) => value},
                clientRoot: {receive: () => undefined},
                representation,
                ownership,
              });
              let attempt = fixture.admit({ownership});

              try {
                fixture.transport.control.releaseReady('server');
                fixture.transport.control.releaseReady('client');

                for (let step = 0; step < RPC_TEST_SESSION_MAX_STEPS; step++) {
                  await fixture.scheduler.runUntilIdle();
                  await fixture.transport.control.deliverAll();

                  if (factories.sessionInspector.inspect(attempt).phase === 'active') {
                    break;
                  }
                }

                expect(
                  factories.sessionInspector.inspect(attempt).phase,
                  'session establishment did not converge within the deterministic step bound',
                ).toBe('active');
                let [serverSession, clientSession] = await Promise.all([
                  attempt.admitted,
                  attempt.connected,
                ]);
                let disconnect = clientSession.disconnect();
                await fixture.scheduler.runUntilIdle();
                await fixture.transport.control.deliverAll();
                await Promise.all([disconnect, serverSession.closed, clientSession.closed]);

                expect(fixture.transport.control.snapshot.closed.server).toBe(ownership === 'rpc');
                expect(fixture.transport.control.snapshot.closed.client).toBe(ownership === 'rpc');
              } finally {
                await fixture.dispose();
              }
            },
          );
        }
      });
    }
  });
}
