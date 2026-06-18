/**
 * @onrails/result/extra — tagged-error helpers.
 */

import type { ResultAsync } from "./async.js";
import { combine, isErr, isOk } from "./result.js";
import type { Result } from "./types.js";

/** Extract error type from a {@link Result} */
export type ErrOf<R> = R extends { _tag: "Err"; readonly error: infer E } ? E : never;

/** Extract success type from a {@link Result} */
export type OkOf<R> = R extends { _tag: "Ok"; readonly value: infer T } ? T : never;

/** Union of error types from a tuple/readonly array of results */
export type UnionErrors<R extends readonly Result<unknown, unknown>[]> = {
  [K in keyof R]: ErrOf<R[K]>;
}[number];

/** Manual union when TS fails to infer multi-step errors (neverthrow #603) */
export type AccumulateErrors<Errors extends readonly unknown[]> = Errors[number];

/**
 * Declare the error union for a pipeline when inference only picks the first step.
 *
 * @example
 * ```ts
 * const errors = declareErrors<ParseError | NetworkError>();
 * const step = errors.annotate(parseThing());
 * ```
 */
export const declareErrors = <E>() => ({
  annotate: <T>(result: Result<T, unknown>): Result<T, E> => result as Result<T, E>,
  annotateAsync: <T>(result: ResultAsync<T, unknown>): ResultAsync<T, E> =>
    result as ResultAsync<T, E>,
});

/** Narrow an error by `kind` when using discriminated unions */
export const hasKind = <E extends { kind: string }, K extends E["kind"]>(
  error: E,
  kind: K,
): error is Extract<E, { kind: K }> => error.kind === kind;

/** Map only errors matching `kind`, leave others unchanged */
export const mapErrKind =
  <E extends { kind: string }, K extends E["kind"], F>(
    kind: K,
    fn: (error: Extract<E, { kind: K }>) => F,
  ) =>
  <T>(result: Result<T, E>): Result<T, E | F> =>
    isErr(result) && hasKind(result.error, kind)
      ? { _tag: "Err", error: fn(result.error) }
      : result;

/**
 * Collect values when all Ok; otherwise first Err encountered.
 *
 * @deprecated Identical to {@link combine}; removed in the next major.
 */
export const collect = combine;

/** True when no result is Err */
export const allOk = <T, E>(results: readonly Result<T, E>[]): boolean => results.every(isOk);
