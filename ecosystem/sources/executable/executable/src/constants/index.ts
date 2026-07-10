import type {ExecutableStatus, Kernel} from '@ai.assistant/contracts/executable';

/** Symbol brand identifying executable instances across module boundaries. */
export const EXECUTABLE_IDENTIFIER = Symbol.for('ai.assistant:Executable');

/** Internal symbol storing the fatal error signal. */
export const EXECUTABLE_ERROR = Symbol('ai.assistant:executable.error');

/** Internal symbol storing the service container. */
export const EXECUTABLE_SERVICE_CONTAINER = Symbol('ai.assistant:executable.serviceContainer');

/** Internal symbol storing the ordinary plugin container. */
export const EXECUTABLE_PLUGIN_CONTAINER = Symbol('ai.assistant:executable.pluginContainer');

/** Internal symbol storing the base renderable signal. */
export const EXECUTABLE_RENDERABLE = Symbol('ai.assistant:executable.renderable');

/** Internal symbol storing the telemetry instance. */
export const EXECUTABLE_TELEMETRY = Symbol('ai.assistant:executable.telemetry');

/** Internal symbol storing the local scope segment. */
export const EXECUTABLE_SCOPE = Symbol('ai.assistant:executable.scope');

/** Internal symbol storing the lifecycle status signal. */
export const EXECUTABLE_STATUS = Symbol('ai.assistant:executable.status');

/** Internal symbol storing the composed renderable signal. */
export const EXECUTABLE_UI = Symbol('ai.assistant:executable.ui');

/** Internal symbol storing the kernel runner. */
export const EXECUTABLE_KERNEL = Symbol('ai.assistant:executable.kernel');

/** Internal symbol storing the parent executable. */
export const EXECUTABLE_PARENT = Symbol('ai.assistant:executable.parent');

/** Internal symbol storing in-flight lifecycle transitions. */
export const EXECUTABLE_TRANSITIONS = Symbol('ai.assistant:executable.transitions');

/** Internal symbol storing injected lifecycle callbacks. */
export const EXECUTABLE_LIFECYCLES = Symbol('ai.assistant:executable.lifecycles');

/** Default local scope segment for a root executable. */
export const EXECUTABLE_DEFAULT_SCOPE = 'executable';

/** Default kernel used when no execution strategy is supplied. */
export const EXECUTABLE_NOOP_KERNEL: Kernel = {name: 'noop-kernel'};

/** Lifecycle states that reject all further lifecycle control. */
export const EXECUTABLE_TERMINAL_STATES: ReadonlySet<ExecutableStatus> = new Set([
  'disposed',
  'error',
]);
