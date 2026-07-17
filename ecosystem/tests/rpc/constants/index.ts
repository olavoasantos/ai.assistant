import type {
  RpcCoreBudgetCategory,
  RpcTransportOwnership,
  RpcTransportRepresentation,
} from '@ai.assistant/contracts/rpc';

/** Complete runtime catalog of stable core budget categories required by compliance. */
export const RPC_TEST_CORE_BUDGET_CATEGORIES: Readonly<Record<RpcCoreBudgetCategory, true>> = {
  'frame.bytes': true,
  'payload.bytes': true,
  'decode.depth': true,
  'decode.entries': true,
  'calls.pending': true,
  'notifications.pending': true,
  'references.object.issued': true,
  'references.object.received': true,
  'references.function.issued': true,
  'references.function.received': true,
  'references.promise.issued': true,
  'references.promise.received': true,
  'references.stream.issued': true,
  'references.stream.received': true,
  'references.plugin.issued': true,
  'references.plugin.received': true,
  'promises.pending': true,
  'streams.active': true,
  'streams.buffered.items': true,
  'streams.buffered.bytes': true,
  'watches.active': true,
  'updates.queued': true,
  'transferables.active': true,
  'plugins.messages.pending': true,
  'plugins.state': true,
};

/** Finite outer bound for deterministic session-establishment progress. */
export const RPC_TEST_SESSION_MAX_STEPS = 100;

/** Default finite work bound used by deterministic scheduler drain operations. */
export const RPC_TEST_SCHEDULER_MAX_STEPS = 10_000;

/** Transport ownership modes exercised by the foundation compliance suite. */
export const RPC_TEST_TRANSPORT_OWNERSHIPS: readonly RpcTransportOwnership[] = ['caller', 'rpc'];

/** Transport representations exercised by the foundation compliance suite. */
export const RPC_TEST_TRANSPORT_REPRESENTATIONS: readonly RpcTransportRepresentation[] = [
  'string',
  'raw',
];
