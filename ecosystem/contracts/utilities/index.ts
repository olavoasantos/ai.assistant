/**
 * ISO 8601 timestamp string.
 *
 * All timestamps in the system use this format for consistency and
 * human-readability. Example: `"2025-05-02T14:30:00.000Z"`.
 */
export type Timestamp = string;

export type MaybeAsync<Value> = Value | Promise<Value>;
