/** Build the stable identity key for a registered intent. */
export function buildIntentIdentityKey(
  action: string,
  mimeType: string,
  scope: string,
  kernel: string,
  vendor: string,
): string {
  return `${action}:${mimeType}:${scope}:${kernel}:${vendor}`;
}
