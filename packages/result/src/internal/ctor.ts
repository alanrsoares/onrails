import type { Result } from "../types.js";

/**
 * Unlocked `Ok` constructor for library internals.
 *
 * The public {@link ok} takes a `const` type parameter so caller literals stay
 * narrow. Internals must never narrow a payload type, so they build results
 * through this constructor instead.
 */
export const mkOk = <T, E = never>(value: T): Result<T, E> => ({
  _tag: "Ok",
  value,
});

/** Unlocked `Err` constructor for library internals. Mirror of {@link mkOk}. */
export const mkErr = <T = never, E = unknown>(error: E): Result<T, E> => ({
  _tag: "Err",
  error,
});
