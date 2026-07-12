<p align="center">
  <img src="https://github.com/olavoasantos/ai.assistant/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@ai.assistant/application</h1>

## About

The unique application root for ai.assistant. It assigns ordinary lifecycle semantics to service providers, owns one kernel, and exposes the root intent registry on the executable lifecycle foundation.

## Installation

```shell
pnpm add @ai.assistant/application
```

## Usage

```ts
import {Application, createServiceProvider} from '@ai.assistant/application';

const configurationProvider = createServiceProvider({
  name: 'configuration',
  create() {
    this.container.value('Configuration', {environment: 'development'});
  },
});

const taskKernel = {name: 'task'};
const application = await Application.activate({
  serviceProviders: [configurationProvider()],
  intents: {
    scopes: [{scope: 'task', kernels: [taskKernel]}],
    definitions: [
      {
        action: 'run',
        mimeType: 'application/vnd.ai.assistant.task',
        scope: 'task',
        kernel: 'task',
        mode: 'detached',
        handler() {},
      },
    ],
  },
});

const activity = await application.intents.invoke('run:application/vnd.ai.assistant.task');
await activity.dispose();
await application.dispose();
```

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
