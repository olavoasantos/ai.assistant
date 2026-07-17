import {bench, describe} from 'vitest';
import type {Plugin} from '@ai.assistant/contracts/plugins';
import {createTestTelemetry} from '../../testing';
import {PluginContainer} from '../PluginContainer';

interface ValueHooks {
  serializeValue(value: unknown): {readonly kind: string} | void;
}

const VALUES: unknown[] = Array.from({length: 256}, (_, index) =>
  index % 16 === 0 ? {pluginValue: index} : {copiedValue: index},
);

const PLUGINS: Plugin<ValueHooks>[] = [
  {name: 'first', serializeValue: () => undefined},
  {name: 'second', serializeValue: () => undefined},
  {name: 'third', serializeValue: () => undefined},
  {
    name: 'matching',
    serializeValue: (value) =>
      typeof value === 'object' && value != null && 'pluginValue' in value
        ? {kind: 'plugin'}
        : undefined,
  },
];

const ORDINARY_CONTAINER = new PluginContainer<ValueHooks>({
  telemetry: createTestTelemetry('ordinary-graph'),
  plugins: PLUGINS,
});

const DIRECT_CONTAINER = new PluginContainer<ValueHooks>({
  telemetry: createTestTelemetry('direct-graph'),
  plugins: PLUGINS,
});

describe('nested value graph traversal', () => {
  bench('measure and prepare every visited value', () => {
    for (const value of VALUES) {
      ORDINARY_CONTAINER.firstSync({hook: 'serializeValue', args: [value]});
    }
  });

  bench('prepare and measure once per graph', () => {
    DIRECT_CONTAINER.direct({
      hook: 'serializeValue',
      execute(executor) {
        for (const value of VALUES) executor.first([value]);
      },
    });
  });
});
