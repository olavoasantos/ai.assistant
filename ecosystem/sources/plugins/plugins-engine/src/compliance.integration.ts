import {PluginContainer} from '.';
import {Telemetry} from '@ai.assistant/telemetry';
import {runPluginsComplianceTests} from '@ai.assistant/tests/plugins';

runPluginsComplianceTests({
  createTelemetry: (options) => new Telemetry({namespace: options?.namespace ?? 'compliance'}),
  createPluginContainer: (options) =>
    new PluginContainer({
      telemetry: options.telemetry,
      contextFactory: options.contextFactory,
      plugins: options.plugins,
    }),
});
