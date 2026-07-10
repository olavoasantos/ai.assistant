import type {StandardSchemaV1} from '@standard-schema/spec';
import type {CompositeValidationOptions, Rule} from '@ai.assistant/contracts/validation';
import {createRule} from '../custom/rule';
import {Ok} from '../utilities/Ok';
import {Err} from '../utilities/Err';
import {traverseArray} from './traverseArray';

/**
 * Create an array validator with an explicit element type.
 *
 * When a type parameter is provided (e.g. `array<User>(...)`),
 * TypeScript validates that the item schema's output type matches the
 * declared element type.
 *
 * @template Output - The explicit element type the item schema must produce.
 * @param itemSchema - A validator whose output type matches `Output`.
 * @param options - Optional validation options including container-level rules.
 */
export function array<Output>(
  itemSchema: Rule<any, Output>,
  options?: CompositeValidationOptions,
): Rule<unknown, Output[]>;
/**
 * Create an array validator.
 *
 * Validates that the input is an array and that each element conforms
 * to the provided item schema. Nested issues carry numeric path segments
 * corresponding to the element index.
 *
 * Container-level rules (e.g. length constraints) can be passed via
 * `options.rules` and apply to the array itself, not its elements.
 *
 * @template S - The item schema type.
 * @param itemSchema - The validator to apply to each array element.
 * @param options - Optional validation options including container-level rules.
 */
export function array<S extends Rule>(
  itemSchema: S,
  options?: CompositeValidationOptions,
): Rule<unknown, StandardSchemaV1.InferOutput<S>[]>;
export function array(
  itemSchema: Rule,
  options?: CompositeValidationOptions,
): Rule<unknown, unknown[]> {
  const {rules, ...validationOptions} = options ?? {};

  return createRule({
    name: 'array',
    options: validationOptions,
    rules,
    validate(value) {
      return Array.isArray(value) ? Ok(value as unknown[]) : Err();
    },
    traverse: traverseArray(itemSchema),
  });
}
