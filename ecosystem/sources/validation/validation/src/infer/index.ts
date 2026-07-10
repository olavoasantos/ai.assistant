import type {StandardSchemaV1} from '@standard-schema/spec';

/**
 * Extract the output type from a Standard Schema compliant validator.
 *
 * Works with any validator that conforms to the Standard Schema spec,
 * including all `@ai.assistant/validation` validators.
 *
 * ```ts
 * import type { Infer } from '@ai.assistant/validation';
 *
 * const schema = string();
 * type Value = Infer<typeof schema>; // string
 * ```
 *
 * @template Schema - A Standard Schema compliant validator.
 */
export type Infer<Schema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<Schema>;

/**
 * Extract the output type from a Standard Schema compliant validator.
 *
 * Alias of {@link Infer} for naming consistency with {@link InferInput}.
 *
 * @template Schema - A Standard Schema compliant validator.
 */
export type InferOutput<Schema extends StandardSchemaV1> = StandardSchemaV1.InferOutput<Schema>;

/**
 * Extract the input type from a Standard Schema compliant validator.
 *
 * For most validators, the input type is `unknown` since validators
 * accept arbitrary input and narrow it during validation.
 *
 * @template Schema - A Standard Schema compliant validator.
 */
export type InferInput<Schema extends StandardSchemaV1> = StandardSchemaV1.InferInput<Schema>;
