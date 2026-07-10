/** Makes selected keys of an object optional while keeping the rest required. */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
