# AGENTS.md

All AI agents and human contributors must follow these conventions strictly.

---

## Pre-flight

Run `pnpm run check` before starting work and after completing tasks. Record what passes and what is already broken — you are not responsible for pre-existing failures but must not make them worse.

---

## Monorepo Structure

This is a pnpm monorepo. Workspace packages use the `@ai.assistant/*` scope.

| Directory     | Purpose                                               | Published |
| ------------- | ----------------------------------------------------- | --------- |
| `packages/*`  | Shared libraries — may be published                   | Yes       |
| `apps/*`      | Applications (web, server, CLI, docs site, etc.)      | No        |
| `examples/*`  | Demonstration projects showing real-world package use | No        |
| `local.pkg/*` | Internal monorepo tooling (config, scripts)           | Never     |
| `.ignore/`   | Product planning — design docs, projects, milestones  | —         |

**Always use the scaffold command** when creating new workspace entries. Never manually create package directories:

```bash
pnpm scaffold package my-lib                    # → packages/my-lib/
pnpm scaffold app my-app                        # → apps/my-app/
pnpm scaffold example my-example                # → examples/my-example/
pnpm scaffold local my-tool                     # → local.pkg/my-tool/
```

This ensures correct `package.json`, `tsconfig.json`, vitest configs, lint/format configs, and README with branded header. Run `pnpm install` after scaffolding.

### Product Planning (`.ignore/`)

```
.ignore/
├── design-document.md                                    # Product vision, audience, features
└── projects/
    └── [project-name]/
        ├── summary.md                                    # Project tech design document
        ├── notes.md                                      # Ideas parking lot
        ├── plan.md                                       # Ordered milestones, implementation plan
        └── milestones/
            └── {000}-[milestone-name]/
                ├── summary.md                            # Milestone tech design document
                ├── notes.md                              # Ideas parking lot
                ├── plan.md                               # Ordered issues, implementation plan
                └── issues/
                    └── M{NNN}I{nnn}[T|B|S|C]/
                        ├── summary.md                    # Issue tech design document
                        ├── notes.md                      # Ideas parking lot
                        └── plan.md                       # Implementation plan
```

**Issue ID format:** `M{NNN}I{nnn}[T|B|S|C]` — e.g. `M001I003T` = Milestone 1, Issue 3, Task. Types: **T**ask, **B**ug, **S**pike, **C**ontent. Zero-padded for filesystem sort order.

**Notes pattern:** Every level (project, milestone, issue) has a `notes.md` that serves as a parking lot for ideas that surface during work at that level but belong elsewhere. Write them down immediately rather than holding them in memory.

### Entry Points (per package)

- **`src/index.ts`** — Public API exports. Must be environment-agnostic.
- **`src/index.css`** — Central stylesheet for the module's critical styles (if applicable).
- **`src/register.d.ts`** — Global type declarations. Used for triple-slash references (e.g. Vite's `client`, Vitest's `globals`), global module definitions, and extending global namespaces to declare services, environment variables, and configurations the module provides.

---

## Naming & Exports

| Element           | Naming                             | Export style | Notes                                                 |
| ----------------- | ---------------------------------- | ------------ | ----------------------------------------------------- |
| Classes           | `PascalCase`                       | Named        | Filename matches class name                           |
| Components        | `PascalCase`                       | Named        | Folder per component, entry is `component.tsx`        |
| Constants         | `MACRO_CASE`                       | Named        | Live in `constants/` only — never inline in utilities |
| Context providers | `PascalCase`                       | Named        | Minimize usage — prefer service container             |
| Data sources      | `PascalCase` + `DataSource` suffix | Named        | Signal-based reactive stores                          |
| Errors            | `PascalCase`                       | Named        | One per file                                          |
| Guards            | `PascalCase` + `Guard` suffix      | Named        | Runtime validation only — never expose inferred types |
| Hooks             | `camelCase` + `use` prefix         | Named        | Standard Preact hook conventions                      |
| Services          | `PascalCase` + `Service` suffix    | Named        | Mediates data source mutations                        |
| Utilities         | `camelCase`                        | Named        | Exactly one function per file — no helpers            |

**Always use named exports.** Default exports are not used in this project.

---

## File Placement

**No deep nesting.** Each directory supports at most one level of subdirectory (typically `specs/` or an asset-type grouping).

### Classes

```
src/classes/
├── MyClass.ts              # Single named class export
└── specs/
    └── MyClass.unit.ts
```

- Filename matches class name.
- A class file defines the class only — no colocated utilities, constants, guards, or extra definitions.
- If helpers are needed, place them in the correct sibling layer (`utilities/`, `constants/`, `guards/`, `types/`).
- **Use classes for domain models with encapsulated behavior.** Classes should implement an interface, making them testable and swappable. Prefer classes over loose utility functions when there is a clear domain model with state and behavior.
- **Standalone logic without state goes in utilities.** If a function doesn't need `this`, an instance, or encapsulated state, it's a utility, not a class method.

### Utilities

```
src/utilities/
├── formatDate.ts           # Exactly one function declaration
└── specs/
    └── formatDate.unit.ts
```

- **Exactly one function per file** — no unexported helpers, no private functions, no companion utilities. If a function needs a helper, that helper gets its own file. This is the most common convention agents violate.
- **Avoid inner/closure function declarations.** Prefer extracting inner functions to their own utility file. The only acceptable use is trivial recursive walkers where the closure captures a local accumulator.
- **No constant declarations in utility files.** Constants (`const SOME_SET = new Set(...)`, lookup tables, configuration objects) belong in `constants/`, never inside a utility file body. A constant declared inside a function is re-created on every call.
- **No circular dependencies between utility files.** If two utilities need each other, it points to a design problem — refactor to break the cycle.
- Filename matches the function name.
- No mixed concerns — utilities must not define constants, guards, or additional exports.
- If a function narrows a type at runtime, it belongs in a guard file, not here.

### Constants

```
src/constants/
└── index.ts               # All module constants grouped in one file
```

- All constants live in `constants/` — never declared inside utility files, class files, or guard files.
- `MACRO_CASE` naming.
- When a module has few constants, a single `constants/index.ts` is preferred. Split into separate files only when the module has many unrelated constant groups.

### Guards

```
src/guards/
├── ThingGuard.ts           # Single named guard export
└── ConfigGuard.ts
```

- One guard per file. `PascalCase` with `Guard` suffix.
- Guards implement **runtime validation only**. Never expose inferred types (e.g. never use `z.infer`). Types are defined explicitly in TypeScript.
- Runtime predicates like `isThing()` or `hasThing()` that narrow a type must live here, not in utility files.

### Errors

```
src/errors/
├── ValidationError.ts      # Single named error export
└── specs/                   # Only if errors have custom logic
    └── ValidationError.unit.ts
```

- One error per file. Tests only required if the error implements custom methods.

### Services

```
src/services/
├── ThingService.ts          # Single named service export
└── specs/
    └── ThingService.unit.ts
```

- `PascalCase` with `Service` suffix.
- Services mediate mutations on data sources — they are the only layer that writes to data source state.
- Must not import from UI-specific modules (components, hooks, context providers).

### Data Sources

```
# Simple
src/data-sources/
├── ThingDataSource.ts
└── specs/
    └── ThingDataSource.unit.ts

# With migrations
src/data-sources/
├── ComplexDataSource/
│   ├── index.ts
│   └── migrations/
│       ├── v1-initial.ts
│       └── v2-add-field.ts
└── specs/
    └── ComplexDataSource.unit.ts
```

- `PascalCase` with `DataSource` suffix.
- Expose **read-only computed signals** only. Never expose writable signals directly.
- Mutations go through associated service classes.
- Migrations live in a `migrations/` subfolder, named with version prefix (`v1-`, `v2-`, etc.).

### Hooks

```
src/hooks/
├── useMyHook.ts
└── specs/
    └── useMyHook.unit.tsx
```

- `camelCase` with `use` prefix. Filename matches the hook name.

### Types

```
src/types/
└── index.ts               # Domain types grouped together
```

- Keep related types together in a single file until the file grows too large.
- If a module has multiple subdomains or bounded contexts, split into files per subdomain (e.g. `types/auth.ts`, `types/billing.ts`) — but avoid one-type-per-file.
- Types that only serve a single utility or class still live in `types/`, not inline in the consuming file.
- No barrel re-exports from `types/index.ts` when using subdomain files — import from the specific file.

---

## UI Architecture

This project uses **Preact** as the rendering framework.

### Component Philosophy

Maximize the use of the web platform. HTML, CSS, and JS each have a role — use each to its fullest instead of swallowing everything into JavaScript.

- **CSS does the heavy lifting.** Variants, sizes, states, and animations are driven by CSS attribute selectors, not JS logic. Use `--ui-*` custom properties for design tokens.
- **HTML is semantic.** Use native elements (`<dialog>`, `<details>`, `<summary>`, `commandfor`/`command` attributes) before reaching for JS abstractions.
- **JS is the thin glue.** Components are minimal wrappers that stamp out semantic HTML with the right attributes. Behavior that CSS and HTML genuinely cannot handle (focus management, ARIA wiring, portals) is the only JS responsibility.
- **`as` attribute convention.** Components render real DOM elements (e.g. `<button>`) and attach an `as` attribute as the CSS styling hook. CSS targets `[as="button"] { ... }`. The `as` attribute is what connects the rendered DOM to the stylesheet — it is not the JSX tag name.

### Component Registry

Components are used as if they were web components, but backed by Preact's virtual DOM via a global component registry wired into Preact's `options.vnode` hook.

```tsx
// What you write (consumer):
<ui-button tone="dangerous">Delete</ui-button>

// What Preact resolves (via registry lookup):
// → Button component renders real DOM:
<button as="button" tone="dangerous">Delete</button>

// What CSS targets:
[as="button"] { ... }
[as="button"][tone="dangerous"] { ... }
```

Three distinct layers:

| Concern              | Mechanism                       | Example                            |
| -------------------- | ------------------------------- | ---------------------------------- |
| Component resolution | Tag name → registry lookup (DI) | `<ui-button>` resolves to `Button` |
| CSS styling hook     | `as` attribute on rendered DOM  | `[as="button"] { ... }`            |
| Platform semantics   | Real DOM element                | `<button>`, `<dialog>`, etc.       |

Consumers never import components directly. They use the registered tag name in JSX and pull in types via triple-slash references in their `register.d.ts`.

### Tag Name Prefixes

Each hierarchy level has a distinct tag name prefix:

| Level     | Prefix       | Example                 | Usage frequency |
| --------- | ------------ | ----------------------- | --------------- |
| Primitive | `primitive-` | `<primitive-dialog>`    | Low             |
| Component | `ui-`        | `<ui-button>`           | High            |
| Block     | `block-`     | `<block-pricing-table>` | Medium          |
| Layout    | `layout-`    | `<layout-dashboard>`    | Low             |

The most commonly used level (`ui-*`) gets the shortest prefix. Less frequent levels use explicit prefixes that self-document their role.

### Type Registration

Each package extends the global `Application.Components` namespace in its `register.d.ts`:

```ts
// packages/ui/src/register.d.ts
import type {ButtonProps} from './components/Button/types';

declare global {
  namespace Application {
    interface Components {
      'ui-button': ButtonProps;
    }
  }
}
```

A centralized integration bridges this to Preact's JSX types:

```ts
declare namespace preact.JSX {
  interface IntrinsicElements extends Application.Components {}
}
```

Consumer apps pull in types via triple-slash references:

```ts
// apps/my-app/src/register.d.ts
/// <reference path="@my-library/components/register" />
```

### Component Hierarchy

UI code is organized into four levels, each in its own top-level directory:

#### Primitives (`src/primitives/`)

Headless building blocks that provide **behavior and accessibility** with zero styling.

- Encapsulate semantics, focus management, keyboard interaction, ARIA wiring, layering/portals, and measurement.
- Completely unstyled — they require styling to become finished UI.
- Single responsibility; composable into styled components.
- Versioning favors stability; breaking changes are rare and documented.

```
src/primitives/
└── Dialog/
    ├── component.tsx
    ├── types.ts
    └── specs/
        └── Dialog.unit.tsx
```

#### Components (`src/components/`)

Styled, reusable UI units. They add visual design to primitives or implement behavior directly with styling.

- Clear props API; supports controlled and uncontrolled usage where applicable.
- Includes default styling but remains override-friendly (classes, tokens, slots).
- Fully keyboard accessible and screen-reader friendly.
- Composable (children/slots, render props, or compound subcomponents).

```
src/components/
└── Button/
    ├── component.tsx        # Single named export
    ├── styles.css           # CSS-driven variants via attribute selectors
    ├── types.ts             # Props and internal types
    ├── constants.ts         # Only when absolutely necessary
    └── specs/
        └── Button.unit.tsx
```

#### Blocks (`src/blocks/`)

Opinionated, production-ready compositions that solve concrete interface use cases. Blocks trade generality for speed of adoption.

- Strong defaults, copy-paste friendly, easily themed.
- Minimal logic beyond layout and orchestration; domain logic is stubbed via handlers.
- Accepts data via props; never hides data fetching without a documented adapter.
- Examples: pricing table, auth screens, onboarding stepper, chat panel.

```
src/blocks/
└── PricingTable/
    ├── component.tsx
    ├── styles.css
    ├── types.ts
    └── specs/
        └── PricingTable.unit.tsx
```

#### Layouts (`src/layouts/`)

Higher-level compositions that define overall page structure and spatial organization.

- Focus on arrangement and visual hierarchy.
- Examples: dashboard layout, settings page layout.

```
src/layouts/
└── DashboardLayout/
    ├── component.tsx
    ├── styles.css
    ├── types.ts
    └── specs/
        └── DashboardLayout.unit.tsx
```

### Component File Conventions

Applies to all four levels (primitives, components, blocks, layouts):

- **Entry file**: Always `component.tsx` — never `index.tsx`. This avoids ambiguous editor tabs and stack traces (`index.tsx` vs `index.tsx` vs `index.tsx`), prevents barrel file creep, and reads clearly in imports (`primitives/Dialog/component`).
- **Styles**: Component styles live in `styles.css`. Import with `import './styles.css'` (side-effect import — bundler handles it). Project-specific import mechanisms (CSS modules, `?inline`, etc.) are decided per project.
- **Types**: Prop definitions and internal types live in `types.ts`. Each package registers its component types in `register.d.ts` by extending `Application.Components`.
- **Constants**: Only when absolutely necessary and hyper-specific to that component. Place in `constants.ts` inside the component folder.
- **Layer separation**: UI components must not contain business logic. They receive read-only signals. Mutations go through services, event handlers, or intent invocations.
- **Context providers**: Minimize usage. The application has its own context mechanisms (service container, configuration, environment). Only use UI context providers when there is no alternative.

---

## Data Layer Rules

- **Signals are read-only in the UI.** UI components receive computed/read-only signals. Mutations go through services.
- **Types are defined in TypeScript, not inferred from runtime.** Type guards (e.g. Zod schemas) implement runtime validation only and must not leak into the type system via `z.infer`.
- **Keep layers separate.** UI code must not contain business logic. Data layer code must not import from UI-specific modules (components, hooks, context providers).

---

## Testing

### Test Types

| Type        | File suffix                              | Purpose                           |
| ----------- | ---------------------------------------- | --------------------------------- |
| Unit        | `*.unit.ts` / `*.unit.tsx`               | Isolated logic, single module     |
| Integration | `*.integration.ts` / `*.integration.tsx` | Cross-module interaction          |
| Performance | `*.bench.ts` / `*.bench.tsx`             | Execution speed, regression guard |
| E2E         | `*.e2e.ts` / `*.e2e.tsx`                 | Full application user flows       |

### Placement

Tests live in a `specs/` folder colocated with the code they test:

```
src/classes/
├── MyClass.ts
└── specs/
    ├── MyClass.unit.ts
    └── MyClass.bench.ts
```

### Rules

- **One test file per production file.** `parseSelector.ts` → `specs/parseSelector.unit.ts`. Never group multiple production files into a shared spec.
- **What needs tests**: every class, service, hook, utility, and data source. Components with non-trivial logic. Errors only if they have custom methods.
- **Performance benchmarks** use Vitest's `bench` API. Use realistic inputs, keep setup outside the `bench()` callback, name benchmarks by workload not function name.
- **Shared test utilities** live in `src/testing/` within modules (mocks, factories).

---

## Documentation

Documentation follows the [Diataxis framework](https://diataxis.fr/):

```
docs/
├── learn/          # Explanation (understanding-oriented)
├── recipes/        # How-to guides (task-oriented)
├── tutorials/      # Tutorials (learning by doing)
└── references/     # API docs (auto-generated from docblocks)
```

Module-specific documentation lives in `packages/<module>/src/docs/` with the same structure.

**Every public export must have JSDoc/TSDoc comments.** Reference documentation is generated from these docblocks.

---

## Code Quality Rules

1. **One concern per file.** Classes, utilities, guards, hooks, and errors each get their own file. For utilities this means **exactly one function declaration per file** — no unexported helpers sharing the file. Every helper function becomes its own utility file.
2. **Constants live in `constants/` only.** Never declare constants inside utility files, class files, or function bodies. A constant declared inside a function is re-created on every call.
3. **No inline `import()` type references.** Always use `import type {Type} from '...'` at the top of the file.
4. **Consolidate imports from the same path.** Never have multiple import statements from the same module. Use inline `type` qualifiers to mix type and value imports in one statement: `import {type Foo, bar} from '...'`. This project uses `verbatimModuleSyntax`, so type-only imports must be marked — use the inline `type` keyword per-specifier rather than a separate `import type` statement when the same path also has value imports.
5. **No `/index` in import paths.** Import from the directory or the specific file, never `'../types/index'`.
6. **No file extensions in imports.** Use `'../types/Thing'`, not `'../types/Thing.ts'`. The bundler and TypeScript's `moduleResolution: bundler` handle resolution.
7. **No deep nesting.** Module subdirectories support at most one level of nesting.
8. **Register types in `register.d.ts`.** When a module provides services, environment variables, or configurations, declare them via global namespace extension.
9. **No new dependencies without consent.** Ask before adding packages.
10. **No issue/milestone IDs in code artifacts.** Issue and milestone identifiers (e.g. `M1T17`) are internal tracking tools. Never reference them in docblocks, commit messages, changeset descriptions, comments, or any other code artifact.

---

## Commits

- **No conventional commit prefixes.** No `feat:`, `fix:`, `docs:`, etc.
- **No AI attribution.** No `Co-Authored-By` or similar.
- **Imperative mood.** "Add search to the sidebar", not "Added search".
- **Subject under 72 characters.** No trailing period.
- **Focus on the "why".** The diff shows what changed — the message explains why.
- **Blank line before body** if additional context is needed.

```
Add workspace setup for examples

Examples are treated as workspace packages so they can consume
the library via pnpm link, simulating a real install.
```
