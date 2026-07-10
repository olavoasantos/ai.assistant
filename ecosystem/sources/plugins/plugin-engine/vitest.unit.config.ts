import {mergeConfig} from 'vitest/config';
import viteConfig from './vite.config';
import unitConfig from '@local.pkg/config/testing/unit';

export default mergeConfig(viteConfig, unitConfig);
