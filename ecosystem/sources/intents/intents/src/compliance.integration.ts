import type {
  Application as ApplicationContract,
  ServiceProvider,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {IntentSystemOptions} from '@ai.assistant/contracts/intents';
import {runIntentsComplianceTests} from '@ai.assistant/tests/intents';
import {Executable} from '@ai.assistant/executable';
import {IntentRegistry} from './classes/IntentRegistry';

runIntentsComplianceTests({
  createRegistry(options: IntentSystemOptions = {}, providers: ServiceProvider[] = []) {
    const app = new Executable<ServiceProviderLifecycles>({plugins: providers});
    return new IntentRegistry({
      app: app as Executable<ServiceProviderLifecycles> & ApplicationContract,
      definitions: options.definitions,
      pluginContainer: app.pluginContainer,
      scopes: options.scopes,
    });
  },
});
