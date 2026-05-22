import { ResultAsync } from "./async.js";
import type { Result, UnexpectedError } from "./types.js";

/** Success type of a {@link Result} or {@link ResultAsync} */
export type InferOk<R> =
  R extends Result<infer T, unknown> ? T : R extends ResultAsync<infer T, unknown> ? T : never;

/** Error type of a {@link Result} or {@link ResultAsync} */
export type InferErr<R> =
  R extends Result<unknown, infer E> ? E : R extends ResultAsync<unknown, infer E> ? E : never;

type AnyResult = Result<unknown, unknown>;

/**
 * Lift `(...args) => Promise<Result<T, E>>` to `(...args) => ResultAsync<T, E>`.
 * Catches unexpected promise rejections (defects) via `onDefect` or {@link UnexpectedError}.
 */
export function fromAsync<A extends readonly unknown[], R extends AnyResult>(
  fn: (...args: A) => Promise<R>,
  onDefect?: (error: unknown) => InferErr<R> | UnexpectedError,
): (...args: A) => ResultAsync<InferOk<R>, InferErr<R> | UnexpectedError> {
  return (...args: A) =>
    ResultAsync.fromResultPromise(fn(...args), onDefect) as ResultAsync<
      InferOk<R>,
      InferErr<R> | UnexpectedError
    >;
}

/** Alias for {@link fromAsync} (neverthrow #608 / #662 naming) */
export const fromPromiseResult = fromAsync;

/**
 * Lift a nullary `Promise<Result<T, E>>` factory to {@link ResultAsync}.
 */
export const makeResultAsync = <R extends AnyResult>(
  fn: () => Promise<R>,
  onDefect?: (error: unknown) => InferErr<R> | UnexpectedError,
): ResultAsync<InferOk<R>, InferErr<R> | UnexpectedError> =>
  ResultAsync.fromResultPromise(fn(), onDefect) as ResultAsync<
    InferOk<R>,
    InferErr<R> | UnexpectedError
  >;

/** Alias used in Alanstack repos (neverthrow #514) */
export const resultAsyncFn = fromAsync;
