import {createViteConfig} from '@local.pkg/config/build/package';
import pkg from './package.json' with {type: 'json'};

export default createViteConfig({
  entry: {
    index: 'src/index.ts',
    'custom/rule/index': 'src/custom/rule/index.ts',
    'string/index': 'src/string/index.ts',
    'string/rules/email': 'src/string/rules/email.ts',
    'string/rules/minLength': 'src/string/rules/minLength.ts',
    'string/rules/maxLength': 'src/string/rules/maxLength.ts',
    'string/rules/trim': 'src/string/rules/trim.ts',
    'number/index': 'src/number/index.ts',
    'number/rules/min': 'src/number/rules/min.ts',
    'number/rules/max': 'src/number/rules/max.ts',
    'boolean/index': 'src/boolean/index.ts',
    'object/index': 'src/object/index.ts',
    'array/index': 'src/array/index.ts',
    'infer/index': 'src/infer/index.ts',
  },
  pkg,
  scope: '@ai.assistant',
});
