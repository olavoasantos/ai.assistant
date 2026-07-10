# Charter — renderable

A value that the rendering engine can display. Covers virtual DOM elements, primitive values, `null`, and `undefined`. This is the standard type for anything that can appear in a rendered tree — component output, children props, signal values destined for display.

## Purpose

Provide a single type alias that describes the full set of values the platform's rendering engine accepts. Consumers depend on `@ai.assistant/contracts/renderable` for the type; the rendering engine and component tree use it as the boundary between data and presentation.

## What It Is

- A type alias (`Renderable`) re-exported from `preact`'s `ComponentChild`, covering everything Preact can render: virtual DOM nodes, strings, numbers, booleans, `null`, `undefined`, and arrays thereof.
- The standard return type for component render functions and the standard type for `children` props.
- The value type for reactive embedding: `ReadonlySignal<Renderable>` is the shape used when a consumer needs to embed a reactive value into a rendering tree (see the signals charter's `Application.ui` exception).

## What It Is Not

- Not a component. It is a value that components produce or receive.
- Not a runtime contract. It carries no behaviour, no identity, and no branding — it is a pure type alias.
- Not domain-aware. It knows nothing about what the values mean; it only describes what the rendering engine can display.

## Invariants

### Contract Surface

`@ai.assistant/contracts/renderable` re-exports `ComponentChild` from `preact` as `Renderable`. Consumers depend on `@ai.assistant/contracts/renderable` for the type reference.

```typescript
// @ai.assistant/contracts/renderable
export type {ComponentChild as Renderable} from 'preact';
```

Rules:

- Consumer code references the type as `Renderable` via `@ai.assistant/contracts/renderable`.
- The underlying type is Preact's `ComponentChild`. The alias exists so consumers depend on the platform's contract, not on `preact` directly.
- Contracts do not re-export runtime rendering functions — only the type.

### Rendering Boundary

- `Renderable` is the boundary between data and presentation. Anything crossing into the rendering tree is typed as `Renderable`.
- Component render functions return `Renderable`.
- `children` props are typed as `Renderable` (or arrays/unions containing it).

### Reactive Embedding

- When a consumer needs to embed a reactive value into a rendering tree, the value is exposed as `ReadonlySignal<Renderable>`.
- The rendering engine subscribes to the signal directly — unwrapping would defeat reactive embedding. This is the documented exception to the signals charter's "getters, not raw signals" rule.
- See [Signals — Public APIs Expose Getters, Not Raw Signals](../signals/README.md#public-apis-expose-getters-not-raw-signals) for the full exception.

### Composed Wrapping

- The `renderable()` plugin-container pattern threads a `Renderable` value through a chain of handlers, where each handler receives the current accumulated value as `children` and returns a new value that wraps or replaces it.
- See [API Conventions — renderable()](./api-conventions.md) for the execution strategy.

## Constraints

- The underlying type is `preact`'s `ComponentChild`. The platform does not define its own renderable union.
- The contract is a pure type alias — no runtime code, no identity, no branding.
- The contract lives in `@ai.assistant/contracts/renderable`.
