import {
  capitalize,
  defer,
  deletePath,
  ensureGid,
  ensureId,
  generateGid,
  generateId,
  generateRandomString,
  getPath,
  globToRegex,
  setPath,
  slugify,
} from '.';
import {runHelpersComplianceTests} from '@ai.assistant/tests/helpers';

runHelpersComplianceTests({
  capitalize,
  defer,
  deletePath,
  ensureGid,
  ensureId,
  generateGid,
  generateId,
  generateRandomString,
  // The getPath signature uses deeply recursive PathValue/PathsOf types that
  // trigger TS2589 during assignability checks. The cast bypasses the deep
  // instantiation; type safety is enforced by the source's own unit tests.
  getPath: getPath as never,
  globToRegex,
  setPath,
  slugify,
});
