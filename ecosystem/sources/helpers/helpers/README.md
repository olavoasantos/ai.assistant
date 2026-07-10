# @ai.assistant/helpers

Small, environment-agnostic utility functions and types shared across the
ai.assistant platform — string manipulation, object path access, identifier
generation and parsing, glob compilation, and promise deferral.

## Installation

```shell
pnpm install @ai.assistant/helpers
```

## Usage

```typescript
import {generateGid, ensureGid, getPath, slugify} from '@ai.assistant/helpers';

const gid = generateGid('Session');
// → 'gid://ai.assistant/Session/a3b9c1d2'

const {resource, id} = ensureGid(gid);
// → { resource: 'Session', id: 'a3b9c1d2' }

const data = {user: {profile: {name: 'Ada'}}};
getPath(data, 'user.profile.name');
// → 'Ada'

slugify('Hello World');
// → 'hello-world'
```

## Documentation

See the [charter](../../../charter/helpers/README.md) for purpose, invariants,
and constraints. API reference is generated from source docblocks.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
