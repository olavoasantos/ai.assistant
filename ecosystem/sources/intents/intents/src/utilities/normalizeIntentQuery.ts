import type {IntentInvokeOptions, IntentQuery} from '@ai.assistant/contracts/intents';
import {parseIntentUri} from './parseIntentUri';

/** Normalize an object or URI query and merge explicit invocation input. */
export function normalizeIntentQuery(
  query: IntentQuery | string,
  options?: IntentInvokeOptions,
): IntentQuery {
  const normalized = typeof query === 'string' ? parseIntentUri(query) : {...query};
  return options == null ? normalized : {...normalized, ...options};
}
