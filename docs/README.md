# Documentation

Welcome to the ai.assistant documentation. This project follows the [Diataxis framework](https://diataxis.fr/) for organizing documentation.

## Categories

### [Learn](learn/)

Explanation guides that build understanding. Read these to understand **why** things work the way they do — concepts, architecture, design decisions, and trade-offs.

### [Tutorials](tutorials/)

Step-by-step learning experiences. Follow these to **learn by doing** — you'll build something concrete and pick up skills along the way.

### [Recipes](recipes/)

Task-oriented how-to guides. Use these when you **know what you want to do** and need practical steps to get it done.

### [References](references/)

API reference documentation, auto-generated from source code docblocks. Look things up here when you need **specific details** about types, functions, interfaces, and configuration options.

## Per-Package Documentation

Individual packages may have their own documentation in `packages/<name>/src/docs/` following the same Diataxis structure.

## Contributing to Documentation

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general contribution guidelines. For documentation specifically:

- Every public export needs JSDoc/TSDoc comments — reference docs are generated from these
- Use `pnpm docs:generate` within a package to regenerate its reference docs
- Place new documentation in the correct Diataxis category
