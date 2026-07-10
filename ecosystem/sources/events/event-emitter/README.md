# @ai.assistant/event-emitter

A typed, bubbling event emitter for the ai.assistant platform. Events carry
typed payloads, bubble through parent-child emitter hierarchies, and support
glob-pattern subscriptions such as `tool:*`.

## Installation

```shell
pnpm install @ai.assistant/event-emitter
```

## Usage

```typescript
import {EventEmitter} from '@ai.assistant/event-emitter';

interface ToolEvents {
  'tool:start': {toolId: string};
  'tool:end': {toolId: string; success: boolean};
  'turn:end': undefined;
}

const emitter = new EventEmitter<ToolEvents>();

emitter.on('tool:*', (event) => {
  console.log(event.type, event.details.toolId);
});

emitter.emit('tool:start', {details: {toolId: 'lathe'}});
// → 'tool:start' 'lathe'
```

## Documentation

See the [charter](../../../charter/events/README.md) for purpose, invariants,
and constraints. API reference is generated from source docblocks.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
