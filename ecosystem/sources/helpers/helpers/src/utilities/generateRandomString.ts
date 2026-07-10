/**
 * Generates a random lowercase alphanumeric string of the given size.
 *
 * Uses `Math.random()` — uniqueness is probabilistic, not guaranteed.
 *
 * @param size - The desired string length. Clamped to a minimum of 1.
 * @returns A random alphanumeric string of exactly `size` characters.
 *
 * @example
 * ```ts
 * generateRandomString(8); // → 'a3b9c1d2'
 * generateRandomString(0); // → 'x' (clamped to 1)
 * ```
 */
export function generateRandomString(size: number = 8): string {
  let result = '';

  // Ensure size is at least 1
  size = Math.max(1, size);

  // Keep adding random chunks until we meet or exceed the target size
  while (result.length < size) {
    // Generate a chunk and strip the "1." prefix
    result += (Math.random() + 1).toString(36).substring(2);
  }

  // Trim exactly to the requested size
  return result.substring(0, size);
}
