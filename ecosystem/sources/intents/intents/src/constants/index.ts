/**
 * The MIME type prefix used to identify vendor-specific intent types.
 *
 * Intent MIME types following the pattern
 * `application/vnd.{vendor}.ai.assistant.*` contain a vendor identifier
 * between this prefix and the `.ai.assistant` segment.
 */
export const VENDOR_MIME_PREFIX = 'application/vnd.';

/** MIME namespace used by non-vendor-specific framework types. */
export const CORE_MIME_NAMESPACE = 'ai.assistant.';

/** Segment separating a vendor identifier from the framework namespace. */
export const VENDOR_MIME_NAMESPACE_SEPARATOR = '.ai.assistant.';

/** Symbol brand identifying {@link ActivityResponder} instances across module boundaries. */
export const ACTIVITY_RESPONDER_IDENTIFIER = Symbol.for('ai.assistant:ActivityResponder');

/** Internal symbol storing the activity mode. */
export const ACTIVITY_RESPONDER_MODE = Symbol('ai.assistant:activityResponder.mode');

/** Internal symbol storing the optional output validation schema. */
export const ACTIVITY_RESPONDER_OUTPUT_SCHEMA = Symbol(
  'ai.assistant:activityResponder.outputSchema',
);

/** Internal symbol storing whether the responder has completed. */
export const ACTIVITY_RESPONDER_COMPLETE = Symbol('ai.assistant:activityResponder.complete');

/** Internal symbol storing the deferred promise for awaitable mode. */
export const ACTIVITY_RESPONDER_DEFERRED = Symbol('ai.assistant:activityResponder.deferred');

/** Internal symbol storing the streaming buffer for streaming mode. */
export const ACTIVITY_RESPONDER_BUFFER = Symbol('ai.assistant:activityResponder.buffer');

/** Internal symbol storing the streaming waiters for streaming mode. */
export const ACTIVITY_RESPONDER_WAITERS = Symbol('ai.assistant:activityResponder.waiters');

/** Internal symbol storing whether the streaming iterator is done. */
export const ACTIVITY_RESPONDER_DONE = Symbol('ai.assistant:activityResponder.done');

/** Symbol brand identifying {@link Intent} instances across module boundaries. */
export const INTENT_IDENTIFIER = Symbol.for('ai.assistant:Intent');

/** Internal symbol storing the action identity field. */
export const INTENT_ACTION = Symbol('ai.assistant:intent.action');

/** Internal symbol storing the MIME type identity field. */
export const INTENT_MIME_TYPE = Symbol('ai.assistant:intent.mimeType');

/** Internal symbol storing the scope identity field. */
export const INTENT_SCOPE = Symbol('ai.assistant:intent.scope');

/** Internal symbol storing the kernel identity field. */
export const INTENT_KERNEL = Symbol('ai.assistant:intent.kernel');

/** Internal symbol storing the vendor identity field. */
export const INTENT_VENDOR = Symbol('ai.assistant:intent.vendor');

/** Internal symbol storing the mutable name field. */
export const INTENT_NAME = Symbol('ai.assistant:intent.name');

/** Internal symbol storing the mutable description field. */
export const INTENT_DESCRIPTION = Symbol('ai.assistant:intent.description');

/** Internal symbol storing the mutable handler function. */
export const INTENT_HANDLER = Symbol('ai.assistant:intent.handler');

/** Internal symbol storing the mutable input validation schema. */
export const INTENT_INPUT_SCHEMA = Symbol('ai.assistant:intent.inputSchema');

/** Internal symbol storing the mutable output validation schema. */
export const INTENT_OUTPUT_SCHEMA = Symbol('ai.assistant:intent.outputSchema');

/** Internal symbol storing the mutable metadata bag. */
export const INTENT_METADATA = Symbol('ai.assistant:intent.metadata');

/** Internal symbol storing the mutable activity mode. */
export const INTENT_MODE = Symbol('ai.assistant:intent.mode');

/** Internal symbol storing the mutable priority value. */
export const INTENT_PRIORITY = Symbol('ai.assistant:intent.priority');

/** Internal symbol storing the signal-backed activities list. */
export const INTENT_ACTIVITIES = Symbol('ai.assistant:intent.activities');

/** Internal symbol storing the registry invoke callback reference. */
export const INTENT_REGISTRY = Symbol('ai.assistant:intent.registry');

/** Symbol brand identifying {@link Activity} instances across module boundaries. */
export const ACTIVITY_IDENTIFIER = Symbol.for('ai.assistant:Activity');

/** Internal symbol storing the intent reference. */
export const ACTIVITY_INTENT = Symbol('ai.assistant:activity.intent');

/** Internal symbol storing the activity execution mode. */
export const ACTIVITY_MODE = Symbol('ai.assistant:activity.mode');

/** Internal symbol storing the validated input data. */
export const ACTIVITY_INPUT = Symbol('ai.assistant:activity.input');

/** Internal symbol storing the containing activity reference. */
export const ACTIVITY_PARENT = Symbol('ai.assistant:activity.parent');

/** Internal symbol storing the root application reference. */
export const ACTIVITY_APP = Symbol('ai.assistant:activity.app');

/** Internal symbol storing the signal-backed children list. */
export const ACTIVITY_CHILDREN = Symbol('ai.assistant:activity.children');

/** Internal symbol storing the ActivityResponder instance. */
export const ACTIVITY_RESPONDER = Symbol('ai.assistant:activity.responder');

/** Internal symbol storing the forked intent registry for this activity. */
export const ACTIVITY_INTENT_REGISTRY = Symbol('ai.assistant:activity.intentRegistry');

/** Symbol brand identifying {@link IntentRegistry} instances across module boundaries. */
export const INTENT_REGISTRY_IDENTIFIER = Symbol.for('ai.assistant:IntentRegistry');

/** Internal symbol storing the signal-backed intents array. */
export const INTENT_REGISTRY_INTENTS = Symbol('ai.assistant:intentRegistry.intents');

/** Internal symbol storing the scope template map. */
export const INTENT_REGISTRY_TEMPLATES = Symbol('ai.assistant:intentRegistry.templates');

/** Internal symbol storing the root application reference. */
export const INTENT_REGISTRY_APP = Symbol('ai.assistant:intentRegistry.app');

/** Internal symbol storing the invocation owner for nested activities. */
export const INTENT_REGISTRY_OWNER = Symbol('ai.assistant:intentRegistry.owner');

/** Internal symbol storing the plugin container reference. */
export const INTENT_REGISTRY_PLUGIN_CONTAINER = Symbol(
  'ai.assistant:intentRegistry.pluginContainer',
);

/** Internal symbol storing the signal of root-level activities. */
export const INTENT_REGISTRY_ACTIVITIES = Symbol('ai.assistant:intentRegistry.activities');
