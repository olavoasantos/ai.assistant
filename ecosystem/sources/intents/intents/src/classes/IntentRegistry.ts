import type {
  IntentDefinition,
  IntentInvokeOptions,
  IntentQuery,
  IntentRegistry as IntentRegistryContract,
  IntentRegistryEventMap,
  ScopeTemplate,
} from '@ai.assistant/contracts/intents';
import type {
  Application as ApplicationContract,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {ReadonlyPluginContainer} from '@ai.assistant/contracts/plugins';
import type {Executable} from '@ai.assistant/executable';
import {ApplicationError} from '@ai.assistant/error';
import type {Signal} from '@ai.assistant/contracts/signals';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {signal} from '@preact/signals-core';
import {
  INTENT_REGISTRY_APP,
  INTENT_REGISTRY_ACTIVITIES,
  INTENT_REGISTRY_IDENTIFIER,
  INTENT_REGISTRY_INTENTS,
  INTENT_REGISTRY_OWNER,
  INTENT_REGISTRY_PLUGIN_CONTAINER,
  INTENT_REGISTRY_TEMPLATES,
} from '../constants';
import {ActivityGuard} from '../guards/ActivityGuard';
import type {IntentRegistryOptions} from '../types';
import {buildIntentIdentityKey} from '../utilities/buildIntentIdentityKey';
import {buildScopeTemplateKey} from '../utilities/buildScopeTemplateKey';
import {expandScopeDefinitions} from '../utilities/expandScopeDefinition';
import {normalizeIntentQuery} from '../utilities/normalizeIntentQuery';
import {Activity} from './Activity';
import {Intent} from './Intent';

/**
 * The intent registry — manages registration, resolution, and invocation.
 *
 * The registry is shared across the activity tree. Registration
 * always happens at the root. Invocation from a child (e.g. from an
 * activity) resolves via the root but associates the new activity as
 * a child of the calling context.
 *
 * Resolution pipeline:
 * 1. **Sync** (`get`/`ensure`) — registry lookup with synchronous match hooks.
 * 2. **Async** (`resolve`/`require`) — triggers `resolve` hooks for
 *    lazy loading, then sync lookup.
 * 3. **Invoke** (`invoke`/`invokeAll`) — resolve → disambiguate →
 *    launch. Full pipeline.
 *
 * Extends {@link EventEmitter} for observability and implements the
 * {@link IntentRegistryContract} from contracts.
 */
export class IntentRegistry
  extends EventEmitter<IntentRegistryEventMap>
  implements IntentRegistryContract
{
  /** @internal Symbol brand for cross-boundary identification. */
  readonly [INTENT_REGISTRY_IDENTIFIER] = true as const;

  /** @internal Signal-backed intents collection. */
  protected [INTENT_REGISTRY_INTENTS]: Signal<Intent[]>;

  /** @internal Scope templates keyed by `scope:kernelName`. */
  protected [INTENT_REGISTRY_TEMPLATES]: Map<string, ScopeTemplate>;

  /** @internal The owning application. */
  protected [INTENT_REGISTRY_APP]: Executable<ServiceProviderLifecycles> & ApplicationContract;

  /** @internal Current executable that owns nested invocations. */
  protected [INTENT_REGISTRY_OWNER]: Executable<ServiceProviderLifecycles>;

  /** @internal Plugin container for firing resolve/match/disambiguate hooks. */
  protected [INTENT_REGISTRY_PLUGIN_CONTAINER]: ReadonlyPluginContainer<ServiceProviderLifecycles>;

  /** @internal Signal-backed root-level activities list. */
  protected [INTENT_REGISTRY_ACTIVITIES]: Signal<Activity[]>;

  /**
   * Creates a new intent registry.
   *
   * @param options - Configuration for the registry.
   */
  constructor(options: IntentRegistryOptions, parent?: IntentRegistry) {
    super();

    this[INTENT_REGISTRY_APP] = options.app;
    this[INTENT_REGISTRY_OWNER] = options.owner ?? options.app;
    this[INTENT_REGISTRY_PLUGIN_CONTAINER] = options.pluginContainer;

    // Fork path: share state from parent
    if (parent) {
      this[INTENT_REGISTRY_INTENTS] = parent[INTENT_REGISTRY_INTENTS];
      this[INTENT_REGISTRY_ACTIVITIES] = parent[INTENT_REGISTRY_ACTIVITIES];
      this[INTENT_REGISTRY_TEMPLATES] = parent[INTENT_REGISTRY_TEMPLATES];
      return;
    }

    // Root path: create fresh state
    this[INTENT_REGISTRY_INTENTS] = signal<Intent[]>([]);
    this[INTENT_REGISTRY_ACTIVITIES] = signal<Activity[]>([]);

    const templates = expandScopeDefinitions(options);
    const templateMap = new Map<string, ScopeTemplate>();
    for (const template of templates) {
      const key = buildScopeTemplateKey(template.scope, template.kernel.name);
      templateMap.set(key, template);
    }
    this[INTENT_REGISTRY_TEMPLATES] = templateMap;

    // Register eager definitions
    if (options?.definitions) {
      for (const definition of options.definitions) {
        this.register(definition);
      }
    }
  }

  /**
   * Registers an intent from a definition.
   *
   * Validates the definition against known scope templates — an
   * unknown scope+kernel combination throws a fatal error.
   *
   * The identity tuple (`action + mimeType + scope + kernel + vendor`)
   * is unique. Registering the same tuple again merges mutable fields
   * via `setMany()` on the existing intent.
   *
   * @param definition - The intent definition to register.
   * @returns The created or updated intent.
   * @throws When the scope+kernel combination is not declared.
   */
  register(definition: IntentDefinition): Intent {
    const scope = definition.scope;
    const kernel = definition.kernel;
    const templateKey = buildScopeTemplateKey(scope, kernel);

    if (!this[INTENT_REGISTRY_TEMPLATES].has(templateKey)) {
      throw new ApplicationError({
        message: `Unknown scope+kernel combination: "${scope}:${kernel}"`,
        severity: 'fatal',
      });
    }

    const vendor = definition.vendor ?? '';
    const identityKey = buildIntentIdentityKey(
      definition.action,
      definition.mimeType,
      scope,
      kernel,
      vendor,
    );

    const existing = this[INTENT_REGISTRY_INTENTS].value.find(
      (intent) =>
        buildIntentIdentityKey(
          intent.action,
          intent.mimeType,
          intent.scope,
          intent.kernel,
          intent.vendor,
        ) === identityKey,
    );

    if (existing) {
      existing.setMany({
        name: definition.name,
        description: definition.description,
        handler: definition.handler,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        metadata: definition.metadata,
        mode: definition.mode,
        priority: definition.priority,
      });
      return existing;
    }

    const intent = new Intent({...definition, vendor}, (intentInstance, invokeOptions) =>
      this.createAndActivateActivity(
        intentInstance as Intent,
        {
          action: intentInstance.action,
          mimeType: intentInstance.mimeType,
          input: invokeOptions?.input,
        },
        this[INTENT_REGISTRY_APP],
      ),
    );

    this[INTENT_REGISTRY_INTENTS].value = [...this[INTENT_REGISTRY_INTENTS].value, intent];
    return intent;
  }

  /**
   * Synchronously resolves the first intent matching the query.
   *
   * Checks registered intents without lazy resolution; synchronous match hooks may veto. Returns `undefined`
   * if no intent matches.
   *
   * @param query - An intent query object or URI string.
   * @returns The first matching intent, or `undefined`.
   */
  get(query: IntentQuery | string, options?: IntentInvokeOptions): Intent | undefined {
    const parsed = normalizeIntentQuery(query, options);
    const intents = this[INTENT_REGISTRY_INTENTS].value;

    for (const intent of intents) {
      if (this.matchIntent(parsed, intent)) {
        return intent;
      }
    }

    return undefined;
  }

  /**
   * Synchronously resolves all intents matching the query.
   *
   * Checks registered intents without lazy resolution; synchronous match hooks may veto. Returns an empty
   * array if no intents match.
   *
   * @param query - An intent query object or URI string.
   * @returns All matching intents.
   */
  getAll(query: IntentQuery | string, options?: IntentInvokeOptions): Intent[] {
    const parsed = normalizeIntentQuery(query, options);
    return this[INTENT_REGISTRY_INTENTS].value.filter((intent) => this.matchIntent(parsed, intent));
  }

  /**
   * Synchronously resolves the first intent matching the query.
   *
   * Checks registered intents without lazy resolution; synchronous match hooks may veto. Throws if no intent
   * matches.
   *
   * @param query - An intent query object or URI string.
   * @returns The first matching intent.
   * @throws When no intent matches the query.
   */
  ensure(query: IntentQuery | string, options?: IntentInvokeOptions): Intent {
    const result = this.get(query, options);

    if (!result) {
      throw new ApplicationError({
        message: `No intent found matching query`,
        code: 404,
      });
    }

    return result;
  }

  /**
   * Synchronously resolves all intents matching the query.
   *
   * Checks registered intents without lazy resolution; synchronous match hooks may veto. Throws if no intents
   * match.
   *
   * @param query - An intent query object or URI string.
   * @returns All matching intents.
   * @throws When no intents match the query.
   */
  ensureAll(query: IntentQuery | string, options?: IntentInvokeOptions): Intent[] {
    const results = this.getAll(query, options);

    if (results.length === 0) {
      throw new ApplicationError({
        message: `No intents found matching query`,
        code: 404,
      });
    }

    return results;
  }

  /**
   * Asynchronously resolves the first intent matching the query.
   *
   * Triggers service provider `resolve` hooks (sequential) to allow
   * lazy registration, then performs sync lookup.
   *
   * @param query - An intent query object or URI string.
   * @returns The first matching intent, or `undefined`.
   */
  async resolve(
    query: IntentQuery | string,
    options?: IntentInvokeOptions,
  ): Promise<Intent | undefined> {
    const parsed = normalizeIntentQuery(query, options);
    await this.runResolveHooks(parsed);
    return this.get(parsed);
  }

  /**
   * Asynchronously resolves all intents matching the query.
   *
   * Triggers service provider `resolve` hooks (sequential) to allow
   * lazy registration, then performs sync lookup.
   *
   * @param query - An intent query object or URI string.
   * @returns All matching intents.
   */
  async resolveAll(query: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent[]> {
    const parsed = normalizeIntentQuery(query, options);
    await this.runResolveHooks(parsed);
    return this.getAll(parsed);
  }

  /**
   * Asynchronously resolves the first intent matching the query.
   *
   * Triggers service provider `resolve` hooks, then performs sync
   * lookup. Throws if no intent matches after resolution.
   *
   * @param query - An intent query object or URI string.
   * @returns The first matching intent.
   * @throws When no intent matches the query after resolution.
   */
  async require(query: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent> {
    const parsed = normalizeIntentQuery(query, options);
    await this.runResolveHooks(parsed);
    return this.ensure(parsed);
  }

  /**
   * Asynchronously resolves all intents matching the query.
   *
   * Triggers service provider `resolve` hooks, then performs sync
   * lookup. Throws if no intents match after resolution.
   *
   * @param query - An intent query object or URI string.
   * @returns All matching intents.
   * @throws When no intents match the query after resolution.
   */
  async requireAll(query: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent[]> {
    const parsed = normalizeIntentQuery(query, options);
    await this.runResolveHooks(parsed);
    return this.ensureAll(parsed);
  }

  /**
   * Full invocation pipeline for a single intent.
   *
   * Resolves → matches → disambiguates → launches the activity.
   *
   * @param query - An intent query object or URI string.
   * @param options - Invocation options including optional input data.
   * @returns A promise resolving to the created activity.
   * @throws When no intent matches the query after resolution.
   * @throws When disambiguation fails (multiple matches, no winner).
   */
  async invoke(query: IntentQuery | string, options?: IntentInvokeOptions): Promise<Activity> {
    const parsed = normalizeIntentQuery(query, options);
    const parent = this[INTENT_REGISTRY_OWNER];

    const matches = await this.requireAll(parsed);

    if (matches.length === 1) {
      return this.createAndActivateActivity(matches[0]!, parsed, parent);
    }

    const winner = await this.disambiguate(parsed, matches);
    return this.createAndActivateActivity(winner, parsed, parent);
  }

  /**
   * Full invocation pipeline for all matching intents.
   *
   * Resolves → matches → launches an activity for each match.
   * No disambiguation — all matches are invoked.
   *
   * @param query - An intent query object or URI string.
   * @param options - Invocation options including optional input data.
   * @returns A promise resolving to all created activities.
   * @throws When no intents match the query after resolution.
   */
  async invokeAll(query: IntentQuery | string, options?: IntentInvokeOptions): Promise<Activity[]> {
    const parsed = normalizeIntentQuery(query, options);
    const parent = this[INTENT_REGISTRY_OWNER];

    const matches = await this.requireAll(parsed);

    const activities: Activity[] = [];
    for (const intent of matches) {
      const activity = await this.createAndActivateActivity(intent, parsed, parent);
      activities.push(activity);
    }

    return activities;
  }

  /** Root-level running activities. */
  get activities(): readonly Activity[] {
    return this[INTENT_REGISTRY_ACTIVITIES].value;
  }

  get size(): number {
    return this[INTENT_REGISTRY_INTENTS].value.length;
  }

  /** Whether the registry contains no intents. */
  get isEmpty(): boolean {
    return this[INTENT_REGISTRY_INTENTS].value.length === 0;
  }

  /**
   * Iterates over all registered intents.
   *
   * @returns An iterator over all intents in the registry.
   */
  [Symbol.iterator](): IterableIterator<Intent> {
    return this[INTENT_REGISTRY_INTENTS].value[Symbol.iterator]();
  }

  /**
   * Create a registry view for nested invocation from another executable.
   *
   * @param owner - Executable that owns activities created through the view.
   * @param pluginContainer - Providers that participate in this scope.
   * @returns A registry sharing definitions and templates with this registry.
   * @internal
   */
  scope(
    owner: Executable<ServiceProviderLifecycles>,
    pluginContainer: ReadonlyPluginContainer<ServiceProviderLifecycles>,
  ): IntentRegistry {
    return new IntentRegistry(
      {
        app: this[INTENT_REGISTRY_APP],
        owner,
        pluginContainer,
      },
      this,
    );
  }

  /**
   * Match immutable intent fields and allow providers to veto the result.
   *
   * @param query - The intent query.
   * @param intent - The candidate intent.
   * @returns Whether the intent matches the query.
   */
  protected matchIntent(query: IntentQuery, intent: Intent): boolean {
    let defaultResult = true;

    if (query.action !== undefined && query.action !== intent.action) {
      defaultResult = false;
    }

    if (query.mimeType !== undefined && query.mimeType !== intent.mimeType) {
      defaultResult = false;
    }

    if (query.vendor !== undefined && query.vendor !== intent.vendor) {
      defaultResult = false;
    }

    // Check plugin match hooks — any provider returning false vetoes the match
    if (this[INTENT_REGISTRY_PLUGIN_CONTAINER].has('match')) {
      const pluginResult = this[INTENT_REGISTRY_PLUGIN_CONTAINER].reduceSync({
        hook: 'match',
        args: [query, intent],
        initial: undefined as boolean | undefined,
        reduce: (acc: boolean | undefined, result: boolean | void) => {
          if (result === false) return false;
          if (acc === false) return false;
          if (result === true && acc === undefined) return true;
          return acc;
        },
      });

      if (pluginResult === false) {
        return false;
      }
    }

    return defaultResult;
  }

  /**
   * Runs the resolve hook on service providers to allow lazy registration.
   *
   * Each provider may return intent definitions to register. Definitions
   * are collected via the reduce strategy and registered into the registry.
   *
   * @param query - The intent query being resolved.
   */
  protected async runResolveHooks(query: IntentQuery): Promise<void> {
    const definitions = await this[INTENT_REGISTRY_PLUGIN_CONTAINER].reduce({
      hook: 'resolve',
      args: [query],
      initial: [] as IntentDefinition[],
      reduce: (accumulator, result) => (result ? [...accumulator, ...result] : accumulator),
    });

    for (const definition of definitions) {
      this.register(definition);
    }
  }

  /**
   * Disambiguates between multiple matching intents.
   *
   * Sorts by priority (higher first), then triggers the service
   * provider `disambiguate` hook (first non-null result wins). Throws
   * when disambiguation fails.
   *
   * @param query - The intent query.
   * @param intents - The ambiguous matching intents.
   * @returns The chosen intent.
   * @throws When multiple intents match and cannot be disambiguated.
   */
  protected async disambiguate(query: IntentQuery, intents: Intent[]): Promise<Intent> {
    const sorted = [...intents].toSorted((a, b) => b.priority - a.priority);

    if (sorted.length > 0 && sorted[0]!.priority > (sorted[1]?.priority ?? -Infinity)) {
      return sorted[0]!;
    }

    const chosen = await this[INTENT_REGISTRY_PLUGIN_CONTAINER].first({
      hook: 'disambiguate',
      args: [query, sorted],
    });

    if (chosen && sorted.includes(chosen as Intent)) {
      return chosen as Intent;
    }

    throw new ApplicationError({
      message: 'Multiple intents match and could not be disambiguated',
      severity: 'fatal',
    });
  }

  /**
   * Creates an activity from an intent and activates it.
   *
   * @param intent - The intent to create an activity for.
   * @param query - The query with input data.
   * @param parent - The parent application or activity.
   * @returns The activated activity.
   */
  protected async createAndActivateActivity(
    intent: Intent,
    query: IntentQuery,
    parent: Executable<ServiceProviderLifecycles>,
  ): Promise<Activity> {
    const templateKey = buildScopeTemplateKey(intent.scope, intent.kernel);
    const template = this[INTENT_REGISTRY_TEMPLATES].get(templateKey);

    if (!template) {
      throw new ApplicationError({
        message: `No scope template found for "${intent.scope}:${intent.kernel}"`,
        severity: 'fatal',
      });
    }

    const app = this[INTENT_REGISTRY_APP];
    const activity = new Activity({
      intent,
      mode: intent.mode,
      input: query.input,
      parent,
      app,
      registry: this,
      kernel: template.kernel,
      serviceProviders: template.serviceProviders,
      outputSchema: intent.outputSchema,
    });

    if (!ActivityGuard.is(parent)) {
      this[INTENT_REGISTRY_ACTIVITIES].value = [
        ...this[INTENT_REGISTRY_ACTIVITIES].value,
        activity,
      ];
    }

    activity.once('executable:disposed', () => {
      this[INTENT_REGISTRY_ACTIVITIES].value = this[INTENT_REGISTRY_ACTIVITIES].value.filter(
        (a) => a !== activity,
      );
    });

    await activity.activate();

    // Execute handler AFTER activation completes (not inside the transition).
    // Errors are routed to the responder for awaitable/streaming modes,
    // and the activity is disposed for cleanup.
    activity.executeHandler().catch((error: unknown) => {
      const appError = ApplicationError.from(error);
      if (activity.mode !== 'detached') {
        try {
          activity.respond.error(appError);
        } catch {
          // Responder already completed — swallow
        }
      }
      void activity.dispose().catch(() => undefined);
    });

    return activity;
  }
}
