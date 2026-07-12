/**
 * Extensible metadata record attached to an {@link ApplicationError}.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific metadata fields.
 */
export interface ErrorMetadata extends Record<string, unknown> {
  //
}

/**
 * Extensible registry of service namespaces available for resolution.
 *
 * Empty by default. Packages extend this interface via declaration merging
 * in their `register.d.ts` to declare the services they provide, giving
 * consumers type-safe service resolution through the service container.
 */
export interface Services {
  //
}

/**
 * Extensible metadata record attached to validation rules via `.meta`.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific metadata fields.
 */
export interface ValidationMetadata extends Record<string, unknown> {
  //
}

/**
 * Extensible lifecycle hook map for the plugin system.
 *
 * Packages define lifecycle hooks by augmenting this interface in their
 * `register.d.ts` files. Each hook is a function that receives arguments
 * and returns a value (sync or async).
 */
export interface Lifecycles {
  //
}

/**
 * Extensible per-plugin store map.
 *
 * Plugins declare their cross-hook state shape by augmenting this interface
 * using their plugin name as the key.
 */
export interface PluginStore {
  //
}

/**
 * Extensible options provided to plugin contexts by the lifecycle owner.
 *
 * The entity that manages lifecycles (e.g. Application) augments this
 * interface to include whatever infrastructure plugins need access to
 * (telemetry, logger, configuration, etc.).
 */
export interface PluginContextOptions {
  //
}

/**
 * Extensible kernel lifecycle hooks shared by executable specializations.
 *
 * Packages augment this interface when their kernels require hooks beyond the
 * foundational executable lifecycle.
 *
 * @template PluginName - Literal provider name used for typed context state.
 */
export interface KernelLifecycles<_PluginName extends string = string> {
  //
}

/**
 * Extensible service-provider hooks shared by executable specializations.
 *
 * Packages augment this interface when providers require hooks beyond the
 * application and activity lifecycle families.
 *
 * @template PluginName - Literal provider name used for typed context state.
 */
export interface ServiceProviderLifecycles<_PluginName extends string = string> {
  //
}

/**
 * Extensible metadata record attached to an {@link Intent}.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific metadata fields.
 */
export interface IntentMetadata extends Record<string, unknown> {}

/**
 * Extensible query object for intent resolution.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific query fields consumed by
 * service provider match hooks.
 */
export interface IntentQuery {
  /** The action verb to match (e.g. `'create'`, `'navigate'`). */
  action?: string;

  /** The MIME type to match (e.g. `'application/vnd.ai.assistant.thing'`). */
  mimeType?: string;

  /** The vendor identifier to match. */
  vendor?: string;

  /** Input data for the invocation. */
  input?: unknown;
}
