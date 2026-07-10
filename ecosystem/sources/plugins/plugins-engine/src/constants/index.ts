/** Symbol brand identifying {@link PluginRunner} instances across module boundaries. */
export const PLUGIN_RUNNER_IDENTIFIER = Symbol.for('ai.assistant:PluginRunner');

/** Symbol brand identifying {@link PluginContainer} instances across module boundaries. */
export const PLUGIN_CONTAINER_IDENTIFIER = Symbol.for('ai.assistant:PluginContainer');

/** Internal symbol storing the plugin context's name. */
export const PLUGIN_CONTEXT_NAME = Symbol('ai.assistant:pluginContext.name');

/** Internal symbol storing the plugin context's mutable store object. */
export const PLUGIN_CONTEXT_STORE = Symbol('ai.assistant:pluginContext.store');

/** Internal symbol storing the plugin context's options. */
export const PLUGIN_CONTEXT_OPTIONS = Symbol('ai.assistant:pluginContext.options');
export const PLUGIN_CONTEXT_TELEMETRY = Symbol('ai.assistant:pluginContext.telemetry');

/** Internal symbol storing the plugin context's frozen flag. */
export const PLUGIN_CONTEXT_FROZEN = Symbol('ai.assistant:pluginContext.frozen');

/** Internal symbol storing the plugin context's disposed flag. */
export const PLUGIN_CONTEXT_DISPOSED = Symbol('ai.assistant:pluginContext.disposed');

/** Internal symbol storing the plugin runner's plugin definition. */
export const PLUGIN_RUNNER_PLUGIN = Symbol('ai.assistant:pluginRunner.plugin');

/** Internal symbol storing the plugin runner's normalized hooks map. */
export const PLUGIN_RUNNER_HOOKS = Symbol('ai.assistant:pluginRunner.hooks');

/** Internal symbol storing the plugin runner's context instance. */
export const PLUGIN_RUNNER_CONTEXT = Symbol('ai.assistant:pluginRunner.context');

/** Internal symbol storing the plugin runner's per-hook cache. */
export const PLUGIN_RUNNER_CACHE = Symbol('ai.assistant:pluginRunner.cache');

/** Internal symbol storing the plugin runner's frozen flag. */
export const PLUGIN_RUNNER_FROZEN = Symbol('ai.assistant:pluginRunner.frozen');

/** Internal symbol storing the plugin runner's disposed flag. */
export const PLUGIN_RUNNER_DISPOSED = Symbol('ai.assistant:pluginRunner.disposed');

/** Internal symbol storing the plugin runner's telemetry client. */
export const PLUGIN_RUNNER_TELEMETRY = Symbol('ai.assistant:pluginRunner.telemetry');

/** Internal symbol storing the container's ordered list of runners. */
export const PLUGIN_CONTAINER_RUNNERS = Symbol('ai.assistant:pluginContainer.runners');

/** Internal symbol storing the container's default context factory. */
export const PLUGIN_CONTAINER_CONTEXT_FACTORY = Symbol(
  'ai.assistant:pluginContainer.contextFactory',
);

/** Internal symbol storing the container's memoized sorted hook entries. */
export const PLUGIN_CONTAINER_SORTED = Symbol('ai.assistant:pluginContainer.sorted');

/** Internal symbol storing the container's frozen flag. */
export const PLUGIN_CONTAINER_FROZEN = Symbol('ai.assistant:pluginContainer.frozen');

/** Internal symbol storing the container's disposed flag. */
export const PLUGIN_CONTAINER_DISPOSED = Symbol('ai.assistant:pluginContainer.disposed');
