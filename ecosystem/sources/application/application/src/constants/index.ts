/** Symbol brand identifying application instances across module boundaries. */
export const APPLICATION_IDENTIFIER = Symbol.for('ai.assistant:Application');

/** Internal symbol storing the root intent registry. */
export const APPLICATION_INTENTS = Symbol('ai.assistant:application.intents');

/** Default local scope segment for a root application. */
export const APPLICATION_DEFAULT_SCOPE = 'app';
