# @ai.assistant/service-container

A typed dependency injection container with fork semantics for the ai.assistant
platform. It manages shared instances, factories, and scoped overrides through
four binding modes — value, singleton, scoped, and transient — with live-link
inheritance across forks.

## Installation

```shell
pnpm install @ai.assistant/service-container
```

## Usage

```typescript
import {ServiceContainer} from '@ai.assistant/service-container';

declare module '@ai.assistant/contracts' {
  interface Services {
    Logger: {log: (msg: string) => void};
    Config: {port: number};
  }
}

const container = new ServiceContainer();

container.value('Config', {port: 3000});
container.singleton('Logger', (c) => ({
  log: (msg: string) => console.log(msg, c.ensure('Config').port),
}));

const logger = container.ensure('Logger');
logger.log('ready');
// → ready 3000
```

## Documentation

See the [charter](../../../charter/service-container/README.md) for purpose,
invariants, and constraints. API reference is generated from source docblocks.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
