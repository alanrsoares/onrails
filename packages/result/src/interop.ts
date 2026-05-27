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

/** Bind a sync {@link Result} into an async step without widening defects. */
export const asyncAfter = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => ResultAsync<U, F>,
): ResultAsync<U, E | F> => fromResult(result).flatMap(fn);

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
