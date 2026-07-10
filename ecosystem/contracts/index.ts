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
 * Extensible metadata record attached to validation rules via `.meta`.
 *
 * Packages can extend this interface via declaration merging in their
 * `register.d.ts` to provide domain-specific metadata fields.
 */
export interface ValidationMetadata extends Record<string, unknown> {}
