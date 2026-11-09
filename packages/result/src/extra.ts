/**
 * @onrails/result/extra — tagged-error helpers.
 */

import type { ResultAsync } from "./async.js";
import { mkErr } from "./internal/ctor.js";
import type { InferErr, InferOk } from "./internal/infer.js";
import { isErr, isOk } from "./result.js";
import type { Result } from "./types.js";

/** Extract error type from a {@link Result} — alias of {@link InferErr} */
export type ErrOf<R> = InferErr<R>;

/** Extract success type from a {@link Result} — alias of {@link InferOk} */
export type OkOf<R> = InferOk<R>;

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
    isErr(result) && hasKind(result.error, kind) ? mkErr(fn(result.error)) : result;

/** True when no result is Err. Stops at the first `Err`. */
export const allOk = <T, E>(results: Iterable<Result<T, E>>): boolean => {
  for (const result of results) if (isErr(result)) return false;
  return true;
};

/**
 * The exit to promise-based libraries that expect a rejecting `Promise`
 * (TanStack Query `queryFn` / `mutationFn`, SWR fetchers, React Router
 * loaders). `Ok` resolves to its value; `Err` rejects with the error as-is.
 *
 * This is the one permitted place where a `Result` becomes a rejection. Keep
 * it at the library boundary; inside the app, stay on the railway with `match`
 * or `await ra`.
 *
 * @example
 * ```ts
 * import { rejectOnErr } from "@onrails/result/extra";
 *
 * useQuery({ queryKey: ["user", id], queryFn: () => rejectOnErr(loadUser(id)) });
 * ```
 */
export const rejectOnErr = <T, E>(source: ResultAsync<T, E>): Promise<T> =>
  source.resolve().then((result) => (isOk(result) ? result.value : Promise.reject(result.error)));
