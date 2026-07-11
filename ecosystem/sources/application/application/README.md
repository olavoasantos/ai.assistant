<p align="center">
  <img src="https://github.com/olavoasantos/ai.assistant/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@ai.assistant/application</h1>

## About

The default top-level application scope for ai.assistant. It assembles service providers and a kernel on the executable lifecycle foundation while preserving scoped services, telemetry, rendering, events, and independent child applications.

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

const application = await Application.activate({
  serviceProviders: [configurationProvider()],
});

const worker = application.fork({scope: 'worker'});
await worker.activate();
await worker.dispose();
await application.dispose();
```

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
