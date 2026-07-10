import {createViteConfig} from '@local.pkg/config/build/package';
import pkg from './package.json' with {type: 'json'};

export default createViteConfig({
  entry: {index: 'src/index.ts'},
  pkg,
  scope: '@ai.assistant',
});
