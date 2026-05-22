/** Narrows `input` when `pattern` is a shallow object or literal discriminant. */
export type Narrow<T, P> = P extends (input: T) => boolean
  ? T
  : P extends Record<string, unknown>
    ? Extract<T, P>
    : T extends P
      ? Extract<T, P>
      : T;
