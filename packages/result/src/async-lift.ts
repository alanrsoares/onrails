import { ResultAsync } from "./async.js";

/**
 * Lifts a value into an `Ok` async result.
 *
 * @example
 * ```ts
 * const r = okAsync(42);                  // ResultAsync<number, never>
 * ```
 */
export const okAsync = ResultAsync.ok;

/**
 * Lifts a value into an `Err` async result.
 *
 * @example
 * ```ts
 * const r = errAsync({ kind: "not_found" as const });
 * ```
 */
export const errAsync = ResultAsync.err;

/**
 * Wraps a `PromiseLike<T>` into a {@link ResultAsync}. Reject reasons go
 * through `onReject` to become typed `Err`s; success becomes `Ok<T>`.
 *
 * @example
 * ```ts
 * const body = fromPromise(
 *   fetch(url).then((r) => r.text()),
 *   (e): NetworkError => ({ kind: "network", cause: String(e) }),
 * );
 * ```
 */
export const fromPromise = ResultAsync.fromPromise;

/**
 * Wraps a `PromiseLike<T>` that **never rejects** into {@link ResultAsync}.
 * Skips the `onReject` mapper. Use only when the promise is provably safe.
 */
export const fromSafePromise = ResultAsync.fromSafePromise;

/**
 * Heterogeneous async tuple combine — branches overlap in wall-clock time.
 * Returns the first `Err` in **input** order (not completion order).
 *
 * @example
 * ```ts
 * const combined = parallelTupleAsync([
 *   loadProfile(id),
 *   loadMetrics(id),
 *   loadFlags(id),
 * ] as const);
 * // ResultAsync<readonly [Profile, Metrics, Flags], …>
 * ```
 */
export const parallelTupleAsync = ResultAsync.combineTupleParallel;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Convenience wrapper over {@link fromPromise} with default `Error`
 * normalization. Call without `onReject` to get `ResultAsync<T, Error>`,
 * or pass a custom mapper for a typed error.
 *
 * @example
 * ```ts
 * // Default: rejection → Err(Error)
 * const a = tryAsync(db.users.insert(row));
 *
 * // Custom: typed error
 * const b = tryAsync(db.users.insert(row), (e): DbError => ({
 *   kind: "db",
 *   cause: e,
 * }));
 * ```
 */
export function tryAsync<T>(promise: PromiseLike<T>): ResultAsync<T, Error>;
export function tryAsync<T, E>(
  promise: PromiseLike<T>,
  onReject: (error: unknown) => E,
): ResultAsync<T, E>;
export function tryAsync<T, E>(
  promise: PromiseLike<T>,
  onReject?: (error: unknown) => E,
): ResultAsync<T, E | Error> {
  return onReject
    ? ResultAsync.fromPromise(promise, onReject)
    : ResultAsync.fromPromise(promise, toError);
}
