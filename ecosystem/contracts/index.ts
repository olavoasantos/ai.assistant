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
export interface Services {}

/**
 * Extensible metadata record attached to validation rules via `.meta`.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific metadata fields.
 */
export interface ValidationMetadata extends Record<string, unknown> {}
