import type {
  Activity,
  ActivityMode,
  IntentDefinition,
  IntentHandler,
  IntentInvokeOptions,
  IntentMutableFields,
  Intent as IntentContract,
} from '@ai.assistant/contracts/intents';
import type {IntentMetadata} from '@ai.assistant/contracts';
import type {Signal} from '@ai.assistant/contracts/signals';
import type {Rule} from '@ai.assistant/contracts/validation';
import {signal} from '@preact/signals-core';
import {
  INTENT_ACTION,
  INTENT_ACTIVITIES,
  INTENT_DESCRIPTION,
  INTENT_HANDLER,
  INTENT_IDENTIFIER,
  INTENT_INPUT_SCHEMA,
  INTENT_KERNEL,
  INTENT_METADATA,
  INTENT_MIME_TYPE,
  INTENT_MODE,
  INTENT_NAME,
  INTENT_OUTPUT_SCHEMA,
  INTENT_PRIORITY,
  INTENT_REGISTRY,
  INTENT_SCOPE,
  INTENT_VENDOR,
} from '../constants';
import type {IntentInvokeCallback} from '../types';

/**
 * A registered definition of an executable unit of work.
 *
 * Holds immutable identity fields (action, mimeType, scope, kernel,
 * vendor) and mutable fields (name, description, handler, schemas,
 * metadata, mode, priority). Identity fields are set at construction
 * and never change. Mutable fields can be updated via {@link setMany}.
 *
 * The identity tuple — `action + mimeType + scope + kernel + vendor` —
 * is globally unique within the registry. Symbol-branded via
 * `Symbol.for('ai.assistant:Intent')`.
 *
 * @template Input - The expected input type for the handler.
 * @template Output - The expected output type for response validation.
 */
export class Intent<Input = unknown, Output = unknown> implements IntentContract<Input, Output> {
  /** @internal Symbol brand for cross-boundary identification. */
  readonly [INTENT_IDENTIFIER] = true;

  /** @internal Immutable action identity field. */
  private [INTENT_ACTION]: string;

  /** @internal Immutable MIME type identity field. */
  private [INTENT_MIME_TYPE]: string;

  /** @internal Immutable scope identity field. */
  private [INTENT_SCOPE]: string;

  /** @internal Immutable kernel identity field. */
  private [INTENT_KERNEL]: string;

  /** @internal Immutable vendor identity field. */
  private [INTENT_VENDOR]: string;

  /** @internal Mutable name field. */
  private [INTENT_NAME]: string | undefined;

  /** @internal Mutable description field. */
  private [INTENT_DESCRIPTION]: string | undefined;

  /** @internal Mutable handler function. */
  private [INTENT_HANDLER]: IntentHandler<Input>;

  /** @internal Mutable input validation schema. */
  private [INTENT_INPUT_SCHEMA]: Rule<unknown, Input> | undefined;

  /** @internal Mutable output validation schema. */
  private [INTENT_OUTPUT_SCHEMA]: Rule<unknown, Output> | undefined;

  /** @internal Mutable metadata bag. */
  private [INTENT_METADATA]: IntentMetadata;

  /** @internal Mutable activity execution mode. */
  private [INTENT_MODE]: ActivityMode;

  /** @internal Mutable priority value. */
  private [INTENT_PRIORITY]: number;

  /** @internal Signal-backed activities list. */
  readonly [INTENT_ACTIVITIES]: Signal<readonly Activity[]>;

  /** @internal Registry invoke callback reference. */
  private [INTENT_REGISTRY]: IntentInvokeCallback;

  /**
   * Creates a new intent from a definition.
   *
   * @param definition - The intent definition containing identity and mutable fields.
   * @param registryInvoke - Callback for delegating invocation to the registry.
   */
  constructor(definition: IntentDefinition<Input, Output>, registryInvoke: IntentInvokeCallback) {
    this[INTENT_ACTION] = definition.action;
    this[INTENT_MIME_TYPE] = definition.mimeType;
    this[INTENT_SCOPE] = definition.scope;
    this[INTENT_KERNEL] = definition.kernel;
    this[INTENT_VENDOR] = definition.vendor ?? '';
    this[INTENT_NAME] = definition.name;
    this[INTENT_DESCRIPTION] = definition.description;
    this[INTENT_HANDLER] = definition.handler;
    this[INTENT_INPUT_SCHEMA] = definition.inputSchema;
    this[INTENT_OUTPUT_SCHEMA] = definition.outputSchema;
    this[INTENT_METADATA] = definition.metadata ?? {};
    this[INTENT_MODE] = definition.mode ?? 'awaitable';
    this[INTENT_PRIORITY] = definition.priority ?? 0;
    this[INTENT_ACTIVITIES] = signal<readonly Activity[]>([]);
    this[INTENT_REGISTRY] = registryInvoke;
  }

  /**
   * The action verb (e.g. `'create'`, `'navigate'`, `'handle'`).
   *
   * Immutable after registration.
   */
  get action(): string {
    return this[INTENT_ACTION];
  }

  /**
   * The subject MIME type (e.g. `'application/vnd.ai.assistant.thing'`).
   *
   * Immutable after registration.
   */
  get mimeType(): string {
    return this[INTENT_MIME_TYPE];
  }

  /**
   * The execution template scope name.
   *
   * Immutable after registration.
   */
  get scope(): string {
    return this[INTENT_SCOPE];
  }

  /**
   * The kernel name within the scope.
   *
   * Immutable after registration.
   */
  get kernel(): string {
    return this[INTENT_KERNEL];
  }

  /**
   * The vendor or developer identifier.
   *
   * Immutable after registration.
   */
  get vendor(): string {
    return this[INTENT_VENDOR];
  }

  /**
   * Human-readable name for the intent.
   */
  get name(): string | undefined {
    return this[INTENT_NAME];
  }

  /**
   * Description of the intent's purpose.
   */
  get description(): string | undefined {
    return this[INTENT_DESCRIPTION];
  }

  /**
   * The handler function that executes the intent's work.
   */
  get handler(): IntentHandler<Input> {
    return this[INTENT_HANDLER];
  }

  /**
   * Validation rule for input data.
   *
   * When present, input is validated against this rule before the
   * handler executes. Validation failure prevents execution.
   */
  get inputSchema(): Rule<unknown, Input> | undefined {
    return this[INTENT_INPUT_SCHEMA];
  }

  /**
   * Validation rule for response data.
   *
   * When present, success response data is validated against this
   * rule before being sent to the consumer.
   */
  get outputSchema(): Rule<unknown, Output> | undefined {
    return this[INTENT_OUTPUT_SCHEMA];
  }

  /**
   * Extensible metadata bag.
   */
  get metadata(): IntentMetadata {
    return this[INTENT_METADATA];
  }

  /**
   * The execution mode for activities spawned by this intent.
   */
  get mode(): ActivityMode {
    return this[INTENT_MODE];
  }

  /**
   * Numeric priority for disambiguation.
   *
   * Higher values win during disambiguation when multiple intents match.
   */
  get priority(): number {
    return this[INTENT_PRIORITY];
  }

  /**
   * Running activities for this intent.
   *
   * A live snapshot of all activities currently associated with
   * this intent. Activities remove themselves on dispose.
   */
  get activities(): readonly Activity[] {
    return this[INTENT_ACTIVITIES].value;
  }

  /**
   * Updates one or more mutable fields in a single call.
   *
   * Map-like fields (metadata) are shallow-merged. Scalar fields
   * (name, description, handler, mode, priority) are replaced.
   * Identity fields (action, mimeType, scope, kernel, vendor)
   * are ignored.
   *
   * @param updates - Partial set of mutable fields to update.
   * @returns This intent for fluent chaining.
   */
  setMany(updates: IntentMutableFields<Input, Output>): this {
    if (updates.name !== undefined) {
      this[INTENT_NAME] = updates.name;
    }
    if (updates.description !== undefined) {
      this[INTENT_DESCRIPTION] = updates.description;
    }
    if (updates.handler !== undefined) {
      this[INTENT_HANDLER] = updates.handler;
    }
    if (updates.inputSchema !== undefined) {
      this[INTENT_INPUT_SCHEMA] = updates.inputSchema;
    }
    if (updates.outputSchema !== undefined) {
      this[INTENT_OUTPUT_SCHEMA] = updates.outputSchema;
    }
    if (updates.metadata !== undefined) {
      this[INTENT_METADATA] = {...this[INTENT_METADATA], ...updates.metadata};
    }
    if (updates.mode !== undefined) {
      this[INTENT_MODE] = updates.mode;
    }
    if (updates.priority !== undefined) {
      this[INTENT_PRIORITY] = updates.priority;
    }
    return this;
  }

  /**
   * Root-level shortcut that bypasses the registry's resolution pipeline.
   *
   * Creates an activity parented to the application, skipping resolution,
   * matching, and disambiguation. Nested callers use their activity-scoped
   * registry when they need parent-child tracking.
   *
   * @param options - Invocation options including optional input data.
   * @returns A promise resolving to the created activity.
   */
  invoke(options?: IntentInvokeOptions): Promise<Activity> {
    return this[INTENT_REGISTRY](this, options);
  }

  /**
   * Serializes this intent into a plain JSON-compatible object.
   *
   * Returns identity fields and serializable mutable fields.
   * Omits handler, inputSchema, and outputSchema since they are
   * not serializable.
   *
   * @returns A plain object representation of this intent.
   */
  toJSON(): Record<string, unknown> {
    return {
      action: this[INTENT_ACTION],
      mimeType: this[INTENT_MIME_TYPE],
      scope: this[INTENT_SCOPE],
      kernel: this[INTENT_KERNEL],
      vendor: this[INTENT_VENDOR],
      name: this[INTENT_NAME],
      description: this[INTENT_DESCRIPTION],
      metadata: this[INTENT_METADATA],
      mode: this[INTENT_MODE],
      priority: this[INTENT_PRIORITY],
    };
  }
}
