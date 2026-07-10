# Charter — API Conventions

Proven patterns for public API design across the platform. This document grows incrementally — a convention is added only after working code demonstrates it.

## Static Factories

### `from()` — Normalization

Converts an unknown or loosely-typed value into the target type. Always returns a **new** instance. Never mutates, never returns the input directly.

```typescript
const error = ApplicationError.from(unknownCaughtValue);
```

Rules:

- Accepts the widest reasonable input type (typically `unknown`).
- Preserves the original value as `.cause` or equivalent for forensic inspection.
- Never throws — every input produces a valid output (even `null`, `undefined`, or primitives).

### `ensure*()` — Throwing access

The `ensure` prefix denotes a throwing variant of a safe operation. The safe form returns `undefined` or a result type on failure; the `ensure` form throws `ApplicationError`.

```typescript
rule.parse(data); // T | undefined
rule.ensureParse(data); // T (throws on failure)
```

Rules:

- The safe form is the unsuffixed name.
- The throwing form prefixes with `ensure`.
- Applied uniformly: `get(k)` / `ensure(k)`, `parse(v)` / `ensureParse(v)`, `validate(v)` / `ensureValid(v)`.

### `create()` / `activate()` — Lifecycle factories

Static convenience methods that construct an instance and advance it to a specific lifecycle state. Named after the target state, not the action performed during construction.

```typescript
const app = await Application.create(options); // → 'initialized'
const app = await Application.activate(options); // → 'active'
```

Rules:

- Each factory returns a `Promise` of the instance at the named state.
- The factory name matches the lifecycle state the instance will be in when the promise resolves (e.g., `create` → `'initialized'` after creation completes, `activate` → `'active'`).
- Factories compose lower-level lifecycle methods internally. `activate()` calls `initialize()` + `activate()` under the hood.
- Construction via `new` remains available for cases where the caller wants an inert instance and explicit lifecycle control.
- Not every class needs these — only classes with async multi-step initialization where a "give me a ready instance" shorthand improves ergonomics.

## Instance Methods

### `add()` / `addMany()` — Collection insertion

Insert one or many items into an aggregation owned by the instance.

```typescript
error.add(childError);
error.addMany([error1, error2, error3]);
```

Rules:

- `add()` accepts a single item.
- `addMany()` accepts a readonly array.
- Both return `this` for fluent chaining.
- Items are normalized on insertion (the container decides the stored shape).

### `removeAll()` — Clear everything

Empties the aggregation completely. No predicate, no partial removal (until a use case demands it).

```typescript
error.removeAll();
```

Rules:

- Returns `this` for fluent chaining.
- After calling, the aggregation is empty (`size === 0`, `isEmpty === true`).

### `set(key, value)` / `setMany(options)` — Post-construction mutation

Mutate specific fields after construction. Two variants with intentionally different semantics:

```typescript
error.set('severity', 'fatal'); // replaces the field
error.setMany({metadata: {a: 1}}); // merges metadata, replaces others
```

Rules:

- `set()` always **replaces** the target field entirely.
- `setMany()` **merges** map-like fields (metadata, config) but **replaces** scalar fields.
- Both return `this` for fluent chaining.
- The set of mutable fields is explicitly typed — not every field is mutable.

### `toJSON(options?)` — Serialization

Produces a plain object safe for `JSON.stringify`. Options control fidelity.

```typescript
const json = error.toJSON({includeStack: true, depth: 3});
```

Rules:

- Returns a plain object (no class instances, no symbols, no functions).
- Optional fields are **omitted** from output when absent — no `null` noise.
- Depth is bounded to prevent infinite recursion.
- Sensitive or debug-only fields (stack traces) are opt-in, not default.

## Structural Patterns

### Options as last argument

Methods that accept configuration take an optional options object as the final parameter.

```typescript
error.toJSON({includeStack: true, depth: 3});
```

### Symbol branding for identity

Cross-boundary type checks use `Symbol.for()` brands, never `instanceof`.

```typescript
const APPLICATION_ERROR_IDENTIFIER = Symbol.for('ai.assistant:ApplicationError');
```

Rules:

- Symbol key format: `'ai.assistant:{TypeName}'`.
- The brand property is readonly and set to `true` at construction.
- Guards check symbol presence and value — no `instanceof` anywhere.

### Identifiers — Two shapes, two purposes

The platform uses two distinct identifier formats chosen by their role:

**Internal identifiers** — ephemeral, operational, never persisted long-term or exposed to users. Used for correlation IDs, performance marks, trace tokens, internal bookkeeping.

```typescript
generateId('telemetry'); // → "telemetry:x8f2k9ab"
generateId('request'); // → "request:m3n7p1q5"
generateId(); // → "ai.assistant:a2b4c6d8"
```

Format: `{prefix}:{hash}`. The prefix namespaces the ID's purpose. The hash is a short random string (8 chars by default). These are cheap, disposable, and unstructured beyond the prefix.

Rules:

- Never stored in the database as entity identifiers.
- Never exposed in public APIs or URLs.
- The prefix describes the subsystem or purpose, not the entity type.
- Default prefix is `'ai.assistant'` when no argument is provided.

**Global identifiers (GIDs)** — durable, cross-boundary, self-describing. Used for domain entities (sessions, people, teams, channels) and source references during data ingestion.

```typescript
generateGid('Session'); // → "gid://ai.assistant/Session/a3b9c1d2"
generateGid({resource: 'Session', id: 12345}); // → "gid://ai.assistant/Session/12345"
generateGid({owner: 'claude-code', resource: 'Session', id: 204}); // → "gid://claude-code/Session/204"
```

Format: `gid://{owner}/{resource}/{id}`. Follows the Shopify/Ruby Global ID convention.

Rules:

- `owner` identifies who owns or sourced the entity (`ai.assistant`, `claude-code`, `pi`, etc.).
- `resource` is the entity type in PascalCase (`Agent`, `User`, `Session`, `Message`).
- `id` is the unique identifier within that owner+resource pair.
- GIDs are parseable via `new URL(gid)` — host = owner, pathname segments = resource/id.
- The same real-world entity may have multiple GIDs from different sources. Resolution/deduplication is a domain concern.
- GIDs are stored in the database and may appear in APIs.

### Fluent chaining on mutators

All mutation methods return `this`, enabling chained calls:

```typescript
error.set('code', 400).set('severity', 'fatal').add(issue);
```

Rules:

- Only mutation methods chain. Accessors, factories, and serializers return their natural type.
- Chaining is a convenience, not a requirement — callers can ignore the return value.

### `validate()` / `ensureValid()` — Validation

The standard API for operations that validate input against a schema.

```typescript
const result = schema.validate(data); // Result<T>
const success = schema.ensureValid(data); // SuccessResult<T> (throws on failure)
const value = schema.parse(data); // T | undefined
const value = schema.ensureParse(data); // T (throws on failure)
const isValid = schema.is(data); // value is T (type predicate)
```

Rules:

- `validate()` returns the full `Result<T>` — discriminated union of success and failure with all issues.
- `ensureValid()` throws on failure, returns `SuccessResult<T>` on success.
- `parse()` extracts just the value (`T | undefined`) — discards the result envelope.
- `ensureParse()` extracts just the value (`T`) or throws.
- `is()` is a TypeScript type predicate — returns `true` when the full validation pipeline succeeds. Narrows the input to `Input & Output`. The parameter is constrained to `Input`, so constrained rules (e.g. `Rule<string, string>`) reject unrelated types at compile time. For transform rules where `Output` differs from `Input`, the narrowed type becomes `never`, safely preventing misuse.
- Results are plain data objects discriminated on `ok: true | false`. No methods on results.

### Result shape

The standard result type for validation operations:

```typescript
// Success
{ ok: true, value: T, issues: undefined }

// Failure
{ ok: false, value: undefined, issues: Issue[] }
```

Rules:

- Discriminated on `ok`, not via methods (`isOk`/`isErr`).
- `issues` is `undefined` on success (not an empty array).
- `value` is `undefined` on failure.
- Issues carry structured message keys, rule name, optional path, and optional interpolation extras.

### `addChild()` / `removeChild()` — Hierarchical ownership

Establish parent-child relationships where one instance owns or contains another.

```typescript
const detach = parent.addChild(child);
parent.removeChild(child);
```

Rules:

- `addChild()` returns a cleanup function that detaches the child.
- `removeChild()` is the explicit imperative form.
- Single-parent constraint: a child can have at most one parent at a time.
- Reparenting is explicit: remove from old parent, then add to new.
- Self-attachment and cycles throw.
- Ignoring `removeChild()` for non-children is safe (no-op).

### Guards — Runtime identity checks

Two guard patterns exist on the platform, chosen by dependency constraints:

**Function guards** (modules that cannot depend on `@ai.assistant/validation`):

```typescript
// Definition
export function ApplicationErrorGuard(value: unknown): value is ApplicationError { ... }

// Usage
if (ApplicationErrorGuard(value)) { ... }
```

**Validation-rule guards** (modules that depend on `@ai.assistant/validation`):

```typescript
// Definition
export const EventGuard = createRule<unknown, Event>({ name: 'Event', validate(value) { ... } });

// Usage
if (EventGuard.is(value)) { ... }         // type predicate
EventGuard.ensureParse(value);             // throws on failure
const event = EventGuard.parse(value);     // Event | undefined
```

Rules:

- Both patterns use the `Guard` suffix naming convention.
- Function guards are callable directly: `Guard(value)` returns `boolean`.
- Rule-based guards use `.is()` for type predicates. **Do not call rule guards directly** — `Guard(value)` returns a `Result` object (always truthy), not a boolean.
- New modules that can depend on `@ai.assistant/validation` should prefer validation-rule guards for the richer API surface.
- Both patterns use `Symbol.for()` brands for cross-boundary identity, never `instanceof`.

### `fork(name, opts?)` — Scoped child creation (namespaced)

Creates a child instance that inherits context from the parent (tags, source, configuration) while narrowing the namespace.

```typescript
const child = telemetry.fork('http', {tags: {layer: 'transport'}});
// child.namespace === 'app.http'
// child inherits parent tags, merged with fork-specific tags
```

Rules:

- `name` is the namespace segment to append. Joined with `.` separator.
- The child inherits parent context (tags, source) unless explicitly overridden.
- The child is wired into the parent's lifecycle (flush cascade, event bubbling).
- Fork from empty namespace produces just `name`, not `.name`.

### `fork(items?, opts?)` — Scoped child creation (isolation)

Creates a child instance that inherits state from the parent with scope isolation. The child operates independently after creation — mutations do not propagate back to the parent.

```typescript
const child = container.fork([extraPlugin], {contextFactory});
// child has all parent plugins (with copied state) + extra plugins
// child store mutations are independent from parent
```

Rules:

- The child inherits parent state via shallow copy (not shared reference).
- After creation, parent and child are fully independent.
- Optional items add to the child's collection beyond what's inherited.
- Optional options override inherited configuration.
- The child is wired as an EventEmitter child for event bubbling.

### `fork(values?)` — Scoped child creation (live-link inheritance)

Creates a child instance that inherits from the parent via live lookup. The child sees parent state registered after creation. Local overrides shadow without affecting the parent.

```typescript
const child = services.fork({Logger: scopedLogger});
// child resolves 'Logger' locally, everything else from parent
// parent registers 'Config' later — child sees it
```

Rules:

- The child inherits parent state via live parent-chain traversal (not snapshot).
- Bindings registered on the parent after fork are visible to the child.
- Local bindings shadow parent bindings without affecting the parent.
- Scoped bindings produce per-child instances; singletons delegate to the parent.
- Optional values pre-populate the child with immediate bindings.
- The child is wired as an EventEmitter child for event bubbling.

### `startFlushing(opts?)` / `stopFlushing()` — Periodic activity lifecycle

Starts or stops a periodic background activity (e.g. flushing a buffer on an interval).

```typescript
telemetry.startFlushing({flushInterval: 5000});
// ... later ...
telemetry.stopFlushing();
```

Rules:

- `startFlushing()` is idempotent — double-start is a no-op.
- `stopFlushing()` is idempotent — double-stop is a no-op.
- `isFlushing` property reflects the current state.
- Options override constructor defaults for the interval.

### `freeze()` — One-way mutation lock

Prevents all recording/mutation methods while allowing read and flush operations. Returns a `ReadonlyT` view.

```typescript
const frozen = telemetry.freeze();
// frozen.namespace, frozen.size, etc. still accessible
// telemetry.record(...) throws
// telemetry.flush() still works
```

Rules:

- Freeze is one-way. There is no `unfreeze()`.
- Returns a readonly view interface (accessor properties only).
- Read operations and flush remain available.
- All recording/mutation methods throw on a frozen instance.

### `dispose()` — Terminal resource cleanup

Releases all resources and marks the instance as permanently unusable.

```typescript
telemetry.dispose();
// All subsequent method calls throw
```

Rules:

- `dispose()` is terminal. After disposal, all public methods throw.
- Calling `dispose()` on an already-disposed instance throws.
- Dispose order: stop activities → cancel pending work → detach children → clear state → detach from parent → set flag.
- Children are detached but not recursively disposed — they remain independently usable.

### `mark(name)` / `measure(start, end)` — Performance timeline markers

Creates named points in time and measures durations between them using the Performance API.

```typescript
const mark = telemetry.mark('request:start');
// ... do work ...
const handle = mark.measure('response-time');
// ... more work ...
handle.stop(); // records the duration

// Or measure between two existing marks:
const start = telemetry.mark('start');
const end = telemetry.mark('end');
telemetry.measure(start, end).stop();
```

Rules:

- Marks are reusable — multiple measurements can originate from the same mark.
- `mark.measure(name)` creates a timer handle from the mark to "now" (when stop/fail is called).
- `measure(start, end)` computes duration immediately but defers recording until `stop()` or `fail()`.
- `mark.cancel()` removes the mark and prevents further measurements from it.

## Structural Patterns — Paired Verbs (additions)

| Pair             | Use                                                            |
| ---------------- | -------------------------------------------------------------- |
| `start` / `stop` | Ongoing background activities (flushing, polling)              |
| `freeze` / —     | One-way mutation lock (no inverse)                             |
| `fork` / —       | Scoped child creation (cleanup via `dispose` or `removeChild`) |
| `trigger` / —    | Invoke a hook if it exists, return result or undefined         |

### `renderable(options)` — Composed wrapping chain

A specialized execution strategy on plugin containers that composes a value by threading it through handlers. Each handler receives the current accumulated value as `children` in its first argument and returns a new value that wraps or replaces it.

```typescript
const composed = pluginContainer.renderable({
  hook: 'ui',
  args: [{children: baseRenderable}],
});
```

Rules:

- Synchronous only — no async variant (rendering composition is always sync).
- Threads `args[0].children` through the chain. Additional properties on `args[0]` are preserved.
- A handler may return null or undefined to intentionally gate the composed value.
- Follows the standard ordering (pre → normal → post) and hook resolution.
- The return type is generic (`ReturnType<HookMap[Name]>`), not hard-coded to a specific renderable type.

### `doThing()` / `doThingSync()` — Async/sync siblings

When both an async and synchronous variant of the same operation exist, the async form is the unsuffixed default. The synchronous form appends `Sync`.

```typescript
container.sequential({hook: 'boot', args: [app]}); // async (returns Promise)
container.sequentialSync({hook: 'boot', args: [app]}); // synchronous
```

Rules:

- Async is the unsuffixed default.
- `Sync` suffix for the blocking sibling.
- If only one variant exists, no suffix regardless of sync/async nature.
- Operations that are inherently async-only (e.g. `parallel`) have no sync variant.

## Conventions Not Yet Proven

The following patterns are anticipated but not codified until working code demonstrates them. They live here as placeholders — a reminder of what to consider, not a commitment.

- `clone()` / `cloneWith()` semantics
- `*Many()` for bulk operations beyond add/set

## Recently Proven Patterns

### `resolve()` / `require()` — Async fetch-then-lookup

Distinct from `get`/`ensure` (sync, registry-only). When the system needs to query external sources before matching:

```typescript
app.intents.get(query); // sync: checks the local registry only
app.intents.resolve(query); // async: triggers provider hooks for lazy loading, then checks registry
app.intents.require(query); // async + throws if not found
```

Rules:

- `get` / `ensure` are sync. They never trigger external lookups.
- `resolve` / `require` are async. They trigger provider hooks to fetch and register definitions, then run the same matching as `get`/`ensure`.
- `resolve` is the safe form (returns `undefined` on miss). `require` throws.
- `*All` variants return arrays: `getAll`, `ensureAll`, `resolveAll`, `requireAll`.

### `respond.*` — Method namespace for structured responses

Group related response methods under a namespace property:

```typescript
activity.respond.success(data);     // send success response
activity.respond.error(error);      // send error response
activity.respond.cancelled();       // send cancelled response
activity.respond.send(response);    // send raw response object
activity.respond.complete(data?);   // complete (aliases success or terminates stream)
```

Rules:

- The namespace object is a getter, not a method.
- Each method on the namespace is a void action (fire-and-done).
- The pattern applies when a single entity has multiple related actions that share a verb concept ("respond") but differ in semantics.

### Activity response envelope

Structured response payload discriminated on `status`:

```typescript
{ status: 'success', data: T }
{ status: 'error', error: ApplicationError }
{ status: 'cancelled' }
```

Rules:

- Discriminated on `status`, not via methods.
- Application-level errors resolve the response (they do not reject the promise).
- Promise rejection is reserved for infrastructure failures (activity disposed, system error).
- `data` is `undefined` when status is not `'success'`. `error` is `undefined` when status is not `'error'`.

### Lifecycle callbacks — Constructor-injected phase behavior

A base class accepts an optional lifecycle callbacks map. Subclasses provide their own callbacks to customize what happens during each lifecycle phase without overriding methods.

```typescript
new Executable({
  lifecycles: {
    create: async () => {
      /* register services */
    },
    activate: async () => {
      /* start listeners */
    },
  },
});
```

Rules:

- All callbacks are optional. Missing callbacks are skipped (only the kernel trigger runs).
- The base class controls WHEN callbacks run (state machine, guards, telemetry). The callback controls WHAT happens.
- Callbacks are called with the instance as `this` (or via closure capture in arrow functions).

### Iterator protocol (`[Symbol.iterator]`)

Signal-backed iterable collections expose `[Symbol.iterator]()`, `size`, and `isEmpty`:

```typescript
for (const intent of app.intents) { ... }
app.intents.size;     // number
app.intents.isEmpty;  // boolean
```

Rules:

- `size` is a getter.
- `isEmpty` is a getter.
- `[Symbol.iterator]()` yields from the current signal value.
- Iteration reflects the current state at the time of iteration.

### Severity log methods

Structured loggers expose one method per severity level:

```typescript
logger.info('Request received', {
  tags: {route: 'sessions'},
  metadata: {requestId: 'request:x8f2k9ab'},
});
```

Rules:

- Levels are ordered: `trace < debug < info < warn < error < fatal`.
- Each method accepts a human-readable message as the first argument.
- The second argument is an optional options object.
- `options.tags` carries string dimensions for filtering and grouping.
- `options.metadata` carries structured diagnostic data.
- `options.cause` carries an original failure or diagnostic value when relevant.
- `setLevel(level)` mutates the minimum emitted severity for that logger.
- `isLevelEnabled(level)` reports whether the logger would emit that severity.
- Log calls are synchronous and fire-and-forget. Transports absorb their own buffering, batching, and delivery behavior.

### Analytics recording methods

Product analytics exposes one method per event class:

```typescript
analytics.track('signup', {
  tags: {surface: 'home'},
  properties: {source: 'hero'},
});
analytics.page('/sessions/123', {title: 'Session details'});
analytics.identify('user:123', {properties: {plan: 'personal'}});
```

Rules:

- Recording calls are synchronous and fire-and-forget. Delivery happens through `flush()`.
- Each method takes the required event subject as the first positional argument and an optional options object last.
- `track(name, options?)` records a named product event.
- `page(path, options?)` records a page view. The path is explicit; analytics does not read browser globals for the contract surface.
- `identify(userId, options?)` records identity and sets sticky identity for future entries on that scope.
- `reset()` clears local sticky identity. On a registry it additionally broadcasts `reset()` to every configured instance so adapter-level sticky identity stays aligned.
- `tags` are inherited string dimensions for filtering and grouping.
- `properties` are structured analytics payloads. Do not call analytics payloads `metadata` or `details`; those terms belong to logging and EventEmitter contexts.
- Analytics entries are plain data objects discriminated by `type`.

### Delivery strictness with `throwOnError`

Event-delivery subsystems that are safe-by-default may expose `throwOnError` as both an instance option and a per-flush override.

```typescript
await analytics.flush({throwOnError: true});
```

Rules:

- Recording calls never throw for delivery failure.
- Delivery failures emit subsystem error events.
- By default, `flush()` resolves after surfacing delivery failures as events.
- When the effective `throwOnError` is true, `flush()` rejects after attempting all pending deliveries.
- Per-call `flush()` options override instance defaults for that call only.

### Adapter/Instance Registry Pattern

For subsystems with multiple implementations (adapters) and multiple configured instances. The registry is a façade that either proxies the contract to a default instance or broadcasts contract calls to every instance, depending on the subsystem's natural routing semantics.

Three-layer structure:

1. **Contract** — the consumed surface (e.g., `Cache`).
2. **Adapter** — a concrete implementation class (e.g., `MemoryCacheAdapter`). Naming: `{Impl}{Subsystem}Adapter`.
3. **Registry** — a façade holding named adapters and instances, proxying the contract to a default.

```typescript
// Register adapter classes (what implementations are available)
cache.setAdapter('memory', MemoryCacheAdapter);
cache.setAdapter('redis', RedisCacheAdapter);

// Create instances from registered adapters (what configured instances exist)
cache.setInstance('hot', 'memory', {
  ttl: 60_000,
  adapter: {maxSize: 1000, evictionPolicy: 'lru'},
  asDefault: true,
});

// Use via default proxy
await cache.get<Thing>('key');

// Or reach for a named instance
await cache.ensureInstance('shared').get<Thing>('key');
```

Rules:

- `setAdapter(name, AdapterClass)` registers a constructor. The registry does not instantiate it.
- `setInstance(name, adapterName, options?)` looks up the adapter, instantiates it with options, stores the result.
- Instance options split general config (top-level) from adapter-specific config (nested under `adapter` key).
- `options.asDefault` designates the new instance as the default.
- Replacing an existing instance disposes the old one before storing the new one.
- Deleting an instance disposes it.
- If the subsystem is single-target by nature (cache, database), contract proxy methods delegate to the default instance and throw when no default is set.
- If the subsystem is fan-out by nature (logger), contract proxy methods broadcast to every configured instance and no-op when no instances are configured.
- Adapter-specific options are typed via subsystem-specific declaration merging interfaces (`CacheAdapters`, `DatabaseAdapters`, `LoggerAdapters`, etc.).
- The registry implements the same contract as its adapters — it's a drop-in.

Adapter management surface: `setAdapter`, `getAdapter`, `ensureAdapter`, `hasAdapter`, `missingAdapter`, `deleteAdapter`, `getAdapterKeys`, `getAdapterValues`, `getAdapterEntries`, `adapterSize`, `forEachAdapter`, `deleteAllAdapters`.

Instance management surface: `setInstance`, `getInstance`, `ensureInstance`, `hasInstance`, `missingInstance`, `deleteInstance`, `getInstanceKeys`, `getInstanceValues`, `getInstanceEntries`, `instanceSize`, `forEachInstance`, `deleteAllInstances`.

Default handling: `getDefaultInstance`, `ensureDefaultInstance`, `setDefaultInstance`, `hasDefaultInstance` (getter), `missingDefaultInstance` (getter). In broadcast registries, default handling exists for explicit instance access and does not control broadcast routing.

### Async-by-default contracts

When a contract's backing store is inherently asynchronous (network, filesystem, remote service), the entire contract is async-by-default.

```typescript
await cache.get<T>('key'); // Promise<T | undefined>
await cache.set('key', value); // Promise<void>
await cache.size(); // Promise<number>
await cache.isEmpty(); // Promise<boolean>
```

Rules:

- `size()` and `isEmpty()` become methods returning promises (getters cannot be async).
- Mutators return `Promise<void>` instead of `Promise<this>` — fluent chaining does not compose with `await`.
- `delete()` returns `Promise<boolean>` (whether the key existed).
- In-memory implementations of async contracts return resolved promises.
- Sync-first contracts with optional async variants still use getters (this rule only applies when the entire contract is async).
