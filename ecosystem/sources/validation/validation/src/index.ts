/**
 * @ai.assistant/validation — Composable runtime validation.
 *
 * Re-exports the core API for convenience. For granular imports,
 * use subpath exports (e.g. `@ai.assistant/validation/string`).
 */
export {createRule} from './custom/rule';
export {Ok} from './utilities/Ok';
export {Err} from './utilities/Err';
export {isRule} from './utilities/isRule';
export {string} from './string';
export {number} from './number';
export {boolean} from './boolean';
export {object} from './object';
export {array} from './array';
export {email} from './string/rules/email';
export {minLength} from './string/rules/minLength';
export {maxLength} from './string/rules/maxLength';
export {trim, type TrimMode} from './string/rules/trim';
export {min} from './number/rules/min';
export {max} from './number/rules/max';
export type {Infer, InferInput, InferOutput} from './infer';
