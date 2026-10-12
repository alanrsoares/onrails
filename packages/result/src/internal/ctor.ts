import type { Result } from "../types.js";
import { newErr, newOk } from "./proto.js";

/**
 * Unlocked `Ok` constructor for library internals.
 *
 * The public {@link ok} takes a `const` type parameter so caller literals stay
 * narrow. Internals must never narrow a payload type, so they build results
 * through this constructor instead.
 */
export const mkOk = <T, E = never>(value: T): Result<T, E> => newOk<T, E>(value);

/** Unlocked `Err` constructor for library internals. Mirror of {@link mkOk}. */
export const mkErr = <T = never, E = unknown>(error: E): Result<T, E> => newErr<T, E>(error);
