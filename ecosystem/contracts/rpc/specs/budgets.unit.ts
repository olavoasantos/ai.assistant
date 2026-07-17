import {describe, expectTypeOf, it} from 'vitest';
import type {
  RpcCoreBudgetCategory,
  RpcCoreBudgetDefinitionMap,
  RpcCoreBudgetLimits,
  RpcCoreResourceObservations,
  RpcPluginBudget,
  RpcPluginBudgetReservationResult,
  RpcPluginResourceObservations,
  RpcSessionBudgetCompatibility,
  RpcSessionBudgetOffer,
  RpcSessionResources,
} from '../budgets';

const coreLimits: RpcCoreBudgetLimits = {
  'frame.bytes': 1,
  'payload.bytes': 1,
  'decode.depth': 1,
  'decode.entries': 1,
  'calls.pending': 1,
  'notifications.pending': 1,
  'references.object.issued': 1,
  'references.object.received': 1,
  'references.function.issued': 1,
  'references.function.received': 1,
  'references.promise.issued': 1,
  'references.promise.received': 1,
  'references.stream.issued': 1,
  'references.stream.received': 1,
  'references.plugin.issued': 1,
  'references.plugin.received': 1,
  'promises.pending': 1,
  'streams.active': 1,
  'streams.buffered.items': 1,
  'streams.buffered.bytes': 1,
  'watches.active': 1,
  'updates.queued': 1,
  'transferables.active': 1,
  'plugins.messages.pending': 1,
  'plugins.state': 1,
};

// @ts-expect-error an explicit offer cannot omit core categories
const incompleteCoreLimits: RpcCoreBudgetLimits = {'frame.bytes': 1};
void incompleteCoreLimits;

const offer: RpcSessionBudgetOffer = {
  core: coreLimits,
  plugins: [
    {
      plugin: 'ai.assistant.preact-signals',
      categories: [
        {category: 'signals.cached', unit: 'count', mode: 'capacity', limit: 1},
        {category: 'updates.bytes', unit: 'bytes', mode: 'capacity', limit: 1},
      ],
    },
  ],
};

function mutateOffer(value: RpcSessionBudgetOffer): void {
  // @ts-expect-error core limits are immutable
  value.core['calls.pending'] = 2;
  // @ts-expect-error plugin offers are immutable
  value.plugins.push({plugin: 'other', categories: []});
  // @ts-expect-error plugin category definitions are immutable
  value.plugins[0]!.categories[0]!.limit = 2;
}

function useReservationResult(result: RpcPluginBudgetReservationResult): void {
  if (result.ok) {
    result.reservation.release();
    expectTypeOf(result.exhaustion).toEqualTypeOf<undefined>();
    // @ts-expect-error a lease releases exactly what it acquired
    result.reservation.release(1);
    return;
  }

  expectTypeOf(result.reservation).toEqualTypeOf<undefined>();
  expectTypeOf(result.exhaustion.disposition).toEqualTypeOf<
    'reject-operation' | 'session-terminating'
  >();
}

function reservePluginResources(budget: RpcPluginBudget<'signals.cached' | 'updates.bytes'>): void {
  budget.reserve({
    entries: 1,
    categories: [{category: 'signals.cached', amount: 1}],
  });
  budget.reserve({
    entries: 1,
    categories: [
      {category: 'signals.cached', amount: 1},
      {category: 'updates.bytes', amount: 32},
    ],
  });
  // @ts-expect-error reservation category must be declared by the plugin
  budget.reserve({entries: 1, categories: [{category: 'other', amount: 1}]});
  // @ts-expect-error reservation category requests must be non-empty
  budget.reserve({entries: 1, categories: []});
  // @ts-expect-error plugin budgets do not expose core categories directly
  void budget.core;
}

function mutateResources(resources: RpcSessionResources): void {
  // @ts-expect-error core observations are immutable
  resources.core['calls.pending'].used = 2;
  // @ts-expect-error plugin observations are immutable
  resources.plugins.push({plugin: 'other', categories: {}});
}

describe('RPC budget contracts', () => {
  it('requires one stable limit for every core category', () => {
    expectTypeOf<RpcCoreBudgetDefinitionMap>().toEqualTypeOf<{
      readonly 'frame.bytes': {readonly unit: 'bytes'; readonly mode: 'maximum'};
      readonly 'payload.bytes': {readonly unit: 'bytes'; readonly mode: 'maximum'};
      readonly 'decode.depth': {readonly unit: 'depth'; readonly mode: 'maximum'};
      readonly 'decode.entries': {readonly unit: 'count'; readonly mode: 'maximum'};
      readonly 'calls.pending': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'notifications.pending': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'references.object.issued': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'references.object.received': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'references.function.issued': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'references.function.received': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'references.promise.issued': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'references.promise.received': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'references.stream.issued': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'references.stream.received': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'references.plugin.issued': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'references.plugin.received': {
        readonly unit: 'count';
        readonly mode: 'capacity';
      };
      readonly 'promises.pending': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'streams.active': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'streams.buffered.items': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'streams.buffered.bytes': {readonly unit: 'bytes'; readonly mode: 'capacity'};
      readonly 'watches.active': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'updates.queued': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'transferables.active': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'plugins.messages.pending': {readonly unit: 'count'; readonly mode: 'capacity'};
      readonly 'plugins.state': {readonly unit: 'count'; readonly mode: 'capacity'};
    }>();
    expectTypeOf<RpcCoreBudgetCategory>().toEqualTypeOf<
      | 'frame.bytes'
      | 'payload.bytes'
      | 'decode.depth'
      | 'decode.entries'
      | 'calls.pending'
      | 'notifications.pending'
      | 'references.object.issued'
      | 'references.object.received'
      | 'references.function.issued'
      | 'references.function.received'
      | 'references.promise.issued'
      | 'references.promise.received'
      | 'references.stream.issued'
      | 'references.stream.received'
      | 'references.plugin.issued'
      | 'references.plugin.received'
      | 'promises.pending'
      | 'streams.active'
      | 'streams.buffered.items'
      | 'streams.buffered.bytes'
      | 'watches.active'
      | 'updates.queued'
      | 'transferables.active'
      | 'plugins.messages.pending'
      | 'plugins.state'
    >();
    expectTypeOf(coreLimits).toEqualTypeOf<RpcCoreBudgetLimits>();
  });

  it('correlates core categories with stable units and accounting modes', () => {
    expectTypeOf<RpcCoreResourceObservations['frame.bytes']>().toEqualTypeOf<{
      readonly unit: 'bytes';
      readonly mode: 'maximum';
      readonly used: number;
      readonly limit: number;
    }>();
    expectTypeOf<RpcCoreResourceObservations['streams.active']>().toEqualTypeOf<{
      readonly unit: 'count';
      readonly mode: 'capacity';
      readonly used: number;
      readonly limit: number;
    }>();
  });

  it('keeps plugin categories structurally qualified', () => {
    expectTypeOf(offer.plugins[0]).toExtend<{
      readonly plugin: string;
      readonly categories: readonly {readonly category: string}[];
    }>();
    expectTypeOf<RpcPluginResourceObservations['plugin']>().toEqualTypeOf<string>();
    expectTypeOf<RpcPluginResourceObservations['categories']>().toEqualTypeOf<
      Readonly<
        Record<
          string,
          {
            readonly unit: 'bytes' | 'count' | 'depth';
            readonly mode: 'capacity';
            readonly used: number;
            readonly limit: number;
          }
        >
      >
    >();
  });

  it('separates local offers from immutable effective compatibility', () => {
    expectTypeOf(offer).toEqualTypeOf<RpcSessionBudgetOffer>();
    expectTypeOf<RpcSessionBudgetCompatibility['core']>().toEqualTypeOf<RpcCoreBudgetLimits>();
    expectTypeOf<RpcSessionBudgetCompatibility['plugins']>().toEqualTypeOf<
      readonly {
        readonly plugin: string;
        readonly categories: readonly {
          readonly category: string;
          readonly unit: 'bytes' | 'count' | 'depth';
          readonly mode: 'capacity';
          readonly limit: number;
        }[];
      }[]
    >();
    expectTypeOf(mutateOffer).toBeFunction();
  });

  it('uses atomic opaque leases without exposing mutable counters', () => {
    expectTypeOf(useReservationResult).toBeFunction();
    expectTypeOf(reservePluginResources).toBeFunction();
    expectTypeOf(mutateResources).toBeFunction();
  });
});
