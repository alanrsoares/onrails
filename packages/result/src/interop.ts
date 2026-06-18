import { ResultAsync } from "./async.js";
import type { Result, UnexpectedError } from "./types.js";

/** Success type of a {@link Result} or {@link ResultAsync} */
export type InferOk<R> = R extends { _tag: "Ok"; readonly value: infer T }
  ? T
  : R extends ResultAsync<infer T, unknown>
    ? T
    : never;

/** Error type of a {@link Result} or {@link ResultAsync} */
export type InferErr<R> = R extends { _tag: "Err"; readonly error: infer E }
  ? E
  : R extends ResultAsync<unknown, infer E>
    ? E
    : never;

type AnyResult = Result<unknown, unknown>;

/** Lift an already-known sync {@link Result} into {@link ResultAsync}. */
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
 * Lift `(...args) => Promise<Result<T, E>>` to `(...args) => ResultAsync<T, E>`.
 * Catches unexpected promise rejections (defects) via `onDefect` or {@link UnexpectedError}.
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
