import {createViteConfig} from '@local.pkg/config/build/package';
import pkg from './package.json' with {type: 'json'};

export default createViteConfig({
  entry: {
    index: 'src/index.ts',
    'types/Constructor': 'src/types/Constructor.ts',
    'types/DotNotation': 'src/types/DotNotation.ts',
    'types/MaybeAsync': 'src/types/MaybeAsync.ts',
    'types/Optional': 'src/types/Optional.ts',
    'utilities/capitalize': 'src/utilities/capitalize.ts',
    'utilities/defer': 'src/utilities/defer.ts',
    'utilities/deletePath': 'src/utilities/deletePath.ts',
    'utilities/ensureGid': 'src/utilities/ensureGid.ts',
    'utilities/ensureId': 'src/utilities/ensureId.ts',
    'utilities/generateGid': 'src/utilities/generateGid.ts',
    'utilities/generateId': 'src/utilities/generateId.ts',
    'utilities/generateRandomString': 'src/utilities/generateRandomString.ts',
    'utilities/getPath': 'src/utilities/getPath.ts',
    'utilities/globToRegex': 'src/utilities/globToRegex.ts',
    'utilities/setPath': 'src/utilities/setPath.ts',
    'utilities/slugify': 'src/utilities/slugify.ts',
  },
  pkg,
  scope: '@ai.assistant',
});
