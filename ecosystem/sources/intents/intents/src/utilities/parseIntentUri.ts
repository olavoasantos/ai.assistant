import type {IntentQuery} from '@ai.assistant/contracts/intents';
import {ApplicationError} from '@ai.assistant/error';
import {
  CORE_MIME_NAMESPACE,
  VENDOR_MIME_NAMESPACE_SEPARATOR,
  VENDOR_MIME_PREFIX,
} from '../constants';

/**
 * Parses an intent URI string into an intent query object.
 *
 * Intent URIs follow the format `action:mimeType?key=value&key2=value2`.
 * The action is the scheme (before the first colon), the MIME type is
 * the path (between the colon and the optional query string), and
 * key-value pairs become the `input` object.
 *
 * When the MIME type matches the vendor pattern
 * `application/vnd.{vendor}.ai.assistant.*`, the vendor identifier is
 * extracted and included in the returned query.
 *
 * @param uri - The intent URI string to parse.
 * @returns A parsed intent query object.
 * @throws When the URI has no colon separator.
 * @throws When the action or MIME type is empty.
 */
export function parseIntentUri(uri: string): IntentQuery {
  const colonIndex = uri.indexOf(':');

  if (colonIndex === -1) {
    throw new ApplicationError({
      message: `Invalid intent URI: missing colon separator in "${uri}"`,
      code: 400,
    });
  }

  const action = uri.slice(0, colonIndex);

  if (action === '') {
    throw new ApplicationError({
      message: `Invalid intent URI: empty action in "${uri}"`,
      code: 400,
    });
  }

  const remainder = uri.slice(colonIndex + 1);
  const questionIndex = remainder.indexOf('?');

  const mimeType = questionIndex === -1 ? remainder : remainder.slice(0, questionIndex);

  if (mimeType === '') {
    throw new ApplicationError({
      message: `Invalid intent URI: empty MIME type in "${uri}"`,
      code: 400,
    });
  }

  const query: IntentQuery = {action, mimeType};

  if (questionIndex !== -1) {
    const queryString = remainder.slice(questionIndex + 1);
    const params = new URLSearchParams(queryString);
    const input: Record<string, string> = {};

    for (const [key, value] of params) {
      input[key] = value;
    }

    if (Object.keys(input).length > 0) {
      query.input = input;
    }
  }

  if (mimeType.startsWith(VENDOR_MIME_PREFIX)) {
    const namespace = mimeType.slice(VENDOR_MIME_PREFIX.length);
    const separatorIndex = namespace.indexOf(VENDOR_MIME_NAMESPACE_SEPARATOR);

    if (!namespace.startsWith(CORE_MIME_NAMESPACE) && separatorIndex > 0) {
      query.vendor = namespace.slice(0, separatorIndex);
    }
  }

  return query;
}
