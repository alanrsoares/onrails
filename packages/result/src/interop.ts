import { ResultAsync } from "./async.js";
import type { Result, UnexpectedError } from "./types.js";

/**
 * Extracts the `Ok` value type from a {@link Result} or {@link ResultAsync},
 * resolving to `never` for any other type.
 *
 * @example
 * ```ts
 * type T = InferOk<Result<number, string>>;        // number
 * type U = InferOk<ResultAsync<User, AppError>>;    // User
 * ```
 */
export type InferOk<R> = R extends { _tag: "Ok"; readonly value: infer T }
  ? T
  : R extends ResultAsync<infer T, unknown>
    ? T
    : never;

/**
 * Extracts the `Err` error type from a {@link Result} or {@link ResultAsync},
 * resolving to `never` for any other type. Mirror of {@link InferOk}.
 *
 * @example
 * ```ts
 * type E = InferErr<Result<number, string>>;        // string
 * type F = InferErr<ResultAsync<User, AppError>>;    // AppError
 * ```
 */
export type InferErr<R> = R extends { _tag: "Err"; readonly error: infer E }
  ? E
  : R extends ResultAsync<unknown, infer E>
    ? E
    : never;

type AnyResult = Result<unknown, unknown>;

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
export const fromResult = <T, E>(result: Result<T, E>): ResultAsync<T, E> =>
  ResultAsync.fromResult(result);

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
export function asyncAfter<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => ResultAsync<U, F>,
): ResultAsync<U, E | F>;
export function asyncAfter<T, U, F>(
  fn: (value: T) => ResultAsync<U, F>,
): <E>(result: Result<T, E>) => ResultAsync<U, E | F>;
export function asyncAfter<T, U, E, F>(
  resultOrFn: Result<T, E> | ((value: T) => ResultAsync<U, F>),
  fn?: (value: T) => ResultAsync<U, F>,
): ResultAsync<U, E | F> | ((result: Result<T, E>) => ResultAsync<U, E | F>) {
  if (fn === undefined) {
    const f = resultOrFn as (value: T) => ResultAsync<U, F>;
    return (result: Result<T, E>): ResultAsync<U, E | F> => fromResult(result).flatMap(f);
  }
  return fromResult(resultOrFn as Result<T, E>).flatMap(fn);
}

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
