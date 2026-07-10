# @ai.assistant/validation

Composable runtime validation for the ai.assistant platform. Validators are
standalone functions that check runtime values and return structured results.

## Installation

```shell
pnpm install @ai.assistant/validation
```

## Usage

```typescript
import {string, minLength, object, number} from '@ai.assistant/validation';

const schema = object({
  name: string([minLength(3)]),
  age: number(),
});

const result = schema.validate({name: 'Ada', age: 37});
// → { ok: true, value: { name: 'Ada', age: 37 }, issues: undefined }
```

## Documentation

See the [charter](../../charter/validation/README.md) for purpose, invariants,
and constraints. API reference is generated from source docblocks.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
