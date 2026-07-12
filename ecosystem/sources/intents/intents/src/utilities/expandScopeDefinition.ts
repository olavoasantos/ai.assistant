import type {IntentSystemOptions, ScopeTemplate} from '@ai.assistant/contracts/intents';

/**
 * Expands scope definitions into flat scope templates.
 *
 * Each scope definition may list multiple kernels. This function
 * produces one template per scope×kernel combination.
 */
export function expandScopeDefinitions(intents?: IntentSystemOptions): ScopeTemplate[] {
  if (!intents?.scopes) return [];

  const templates: ScopeTemplate[] = [];
  for (const scope of intents.scopes) {
    for (const kernel of scope.kernels) {
      templates.push({
        scope: scope.scope,
        kernel,
        serviceProviders: scope.serviceProviders ?? [],
      });
    }
  }
  return templates;
}
