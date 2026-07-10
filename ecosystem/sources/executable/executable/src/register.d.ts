import type {Services} from '@ai.assistant/contracts';
import type {ServiceContainer} from '@ai.assistant/contracts/service-container';

declare module '@ai.assistant/contracts' {
  interface PluginContextOptions {
    /** Service container belonging to the executable scope. */
    readonly container: ServiceContainer<Services>;
  }
}
