<p align="center">
  <img src="https://github.com/olavoasantos/ai.assistant/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@ai.assistant/executable</h1>

<p align="center">
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/docs">Documentation</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CONTRIBUTING.md">Contributing</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CODE_OF_CONDUCT.md">Code of Conduct</a>
</p>

## About

The default implementation of ai.assistant's executable lifecycle primitive. It coordinates scoped services, inherited plugins, telemetry, rendering, lifecycle events, and one kernel while leaving plugin lifecycle policy to deliberate specializations.

## Installation

```shell
pnpm add @ai.assistant/executable
```

## Usage

```ts
import {Executable} from '@ai.assistant/executable';

const worker = await Executable.activate({
  scope: 'worker',
  lifecycles: {
    activate() {
      // Start work owned by this scope.
    },
    deactivate() {
      // Pause work so this scope can reactivate later.
    },
  },
});

await worker.deactivate();
await worker.activate();
await worker.dispose();
```

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
