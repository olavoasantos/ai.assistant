import type {StandardSchemaV1} from '@standard-schema/spec';
import type {ObjectValidationOptions, Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../custom/rule';
import {Ok} from '../utilities/Ok';
import {Err} from '../utilities/Err';
import {traverseObject, type Shape} from './traverseObject';

/**
 * Infer the output type from an object shape by extracting each property
 * validator's output type via the Standard Schema spec.
 */
type InferShape<S extends Shape> = {
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
};

/**
 * Create an object validator with passthrough extra properties.
 *
 * Unknown keys are preserved in the validated output and the output
 * type is widened with `Record<string, unknown>`.
 *
 * @template S - The shape type mapping property keys to validators.
 * @param shape - A mapping of property keys to their validators.
 * @param options - Validation options with `extraProperties: 'passthrough'`.
 */
export function object<S extends Shape>(
  shape: S,
  options: ObjectValidationOptions & {extraProperties: 'passthrough'},
): Rule<unknown, InferShape<S> & Record<string, unknown>>;
/**
 * Create an object validator with an explicit output type.
 *
 * When a type parameter is provided (e.g. `object<User>({...})`),
 * TypeScript validates that the shape's keys and validator output types
 * match the declared output type.
 *
 * @template Output - The explicit output type the shape must conform to.
 * @param shape - A mapping whose keys and validator output types match `Output`.
 * @param options - Optional validation options.
 */
export function object<Output extends object>(
  shape: {[K in keyof Output]-?: Rule<any, Output[K]>},
  options?: ObjectValidationOptions,
): Rule<unknown, Output>;
/**
 * Create an object validator.
 *
 * Validates that the input is a plain object and that each property
 * conforms to the validator declared in the shape.
 *
 * The `extraProperties` option controls how keys not declared in `shape`
 * are handled:
 *
 * - `'strip'` (default) — unknown keys are omitted from the output.
 * - `'reject'` — unknown keys produce validation issues.
 * - `'passthrough'` — unknown keys are preserved in the output.
 *
 * @template S - The shape type mapping property keys to validators.
 * @param shape - A mapping of property keys to their validators.
 * @param options - Optional validation options.
 */
export function object<S extends Shape>(
  shape: S,
  options?: ObjectValidationOptions,
): Rule<unknown, InferShape<S>>;
export function object(
  shape: Shape,
  options?: ObjectValidationOptions,
): Rule<unknown, Record<PropertyKey, unknown>> {
  const {extraProperties, rules, ...validationOptions} = options ?? {};

  return createRule({
    name: 'object',
    options: validationOptions,
    rules,
    validate(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Ok(value as Record<PropertyKey, unknown>)
        : Err();
    },
    traverse: traverseObject(shape, {extraProperties}),
  });
}
