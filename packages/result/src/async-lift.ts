/**
 * @onrails/result — THE lift module. Every "value → {@link ResultAsync}"
 * entry point is defined exactly once, here: `okAsync`, `errAsync`,
 * `fromPromise`, `fromSafePromise`, `fromResult`, `fromAsync`, `asyncAfter`,
 * `tryAsync`.
 */

import { ResultAsync } from "./async.js";
import { dual } from "./internal/dual.js";
import type { InferErr, InferOk } from "./internal/infer.js";
import type { Result, UnexpectedError } from "./types.js";

// The bare renames below detach statics from the class. Safe: every
// `ResultAsync` static references the class by name (`new ResultAsync`,
// `ResultAsync.combine`), never `this`.

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
 * Lifts an already-settled sync {@link Result} into a {@link ResultAsync}, so
 * it can be chained alongside async steps in a railway.
 *
 * @example
 * ```ts
 * const ra = fromResult(ok(1));            // ResultAsync<number, never>
 * await fromResult(err(error)).resolve();  // Err(error)
 * ```
 */
export const fromResult = ResultAsync.fromResult;

/**
 * Bind a sync {@link Result} into an async step without widening defects.
 * Dual-form: data-first for one-shots, data-last (curried) for `pipe`/`flow`.
 *
 * @example
 * ```ts
 * asyncAfter(result, (u) => tryAsync(db.insert(u), toErr)); // data-first
 * asyncAfter((u) => tryAsync(db.insert(u), toErr));         // data-last
 * ```
 */
export const asyncAfter: {
  <T, U, E, F>(result: Result<T, E>, fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F>;
  <T, U, F>(
    fn: (value: T) => ResultAsync<U, F>,
  ): <E>(result: Result<T, E>) => ResultAsync<U, E | F>;
} = dual(
  2,
  <T, U, E, F>(result: Result<T, E>, fn: (value: T) => ResultAsync<U, F>): ResultAsync<U, E | F> =>
    fromResult(result).flatMap(fn),
);

type AnyResult = Result<unknown, unknown>;

/**
 * Lifts a `(...args) => Promise<Result<T, E>>` function (typical of interop or
 * boundary code) into one returning `(...args) => ResultAsync<T, E>`. Expected
 * `Err`s pass through; an unexpected promise rejection (a defect) is routed via
 * `onDefect`, defaulting to {@link UnexpectedError} and widening the error union.
 *
 * @param fn - a function returning a promise that already yields a `Result`
 * @param onDefect - maps an unexpected rejection to the `Err` channel
 *
 * @example
 * ```ts
 * const loadUser = fromAsync(
 *   (id: string): Promise<Result<User, NotFound>> => api.getUser(id),
 * );
 * const ra = loadUser("u1");   // ResultAsync<User, NotFound | UnexpectedError>
 * ```
 */
export const fromAsync =
  <A extends readonly unknown[], R extends AnyResult>(
    fn: (...args: A) => Promise<R>,
    onDefect?: (error: unknown) => InferErr<R> | UnexpectedError,
  ): ((...args: A) => ResultAsync<InferOk<R>, InferErr<R> | UnexpectedError>) =>
  (...args: A) =>
    ResultAsync.fromResultPromise(fn(...args), onDefect) as ResultAsync<
      InferOk<R>,
      InferErr<R> | UnexpectedError
    >;

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
