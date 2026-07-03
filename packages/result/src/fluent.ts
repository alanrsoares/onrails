import type { ResultAsync } from "./async.js";
import {
  bimap,
  flatMap,
  map,
  mapErr,
  match,
  recover,
  show,
  tap,
  tapErr,
  unwrapOr,
} from "./result.js";
import type { Result } from "./types.js";

/** Opt-in dot chaining over a sync {@link Result} */
export type FluentResult<T, E> = {
  readonly result: Result<T, E>;
  map: <U>(fn: (value: T) => U) => FluentResult<U, E>;
  mapErr: <F>(fn: (error: E) => F) => FluentResult<T, F>;
  bimap: <U, F>(onOk: (value: T) => U, onErr: (error: E) => F) => FluentResult<U, F>;
  flatMap: <U, F = E>(fn: (value: T) => Result<U, F>) => FluentResult<U, E | F>;
  andThen: <U, F = E>(fn: (value: T) => Result<U, F>) => FluentResult<U, E | F>;
  recover: <F>(fn: (error: E) => Result<T, F>) => FluentResult<T, F>;
  tap: (fn: (value: T) => void) => FluentResult<T, E>;
  tapErr: (fn: (error: E) => void) => FluentResult<T, E>;

  match: <U>(onOk: (value: T) => U, onErr: (error: E) => U) => U;
  unwrapOr: (defaultValue: T) => T;
  /** Exit the wrapper — hand back the canonical plain-data result. */
  toResult: () => Result<T, E>;
  /** Debug terminal — `Ok(…)` / `Err(…)`, same output as {@link show}. */
  toString: () => string;
};

/**
 * Wrap a {@link Result} for opt-in dot chaining — app-edge sugar. Keep the
 * data-first helpers ({@link map}, {@link flatMap}) in library internals.
 *
 * Mirrors every core transform; `test/parity.spec.ts` enforces the mirror.
 *
 * @example
 * ```ts
 * fluent(ok(2)).map((n) => n * 3).unwrapOr(0); // 6
 * ```
 */
export const fluent = <T, E>(result: Result<T, E>): FluentResult<T, E> => ({
  result,
  map: (fn) => fluent(map(result, fn)),
  mapErr: (fn) => fluent(mapErr(result, fn)),
  bimap: (onOk, onErr) => fluent(bimap(result, onOk, onErr)),
  flatMap: (fn) => fluent(flatMap(result, fn)),
  andThen: (fn) => fluent(flatMap(result, fn)),
  recover: (fn) => fluent(recover(result, fn)),
  tap: (fn) => fluent(tap(result, fn)),
  tapErr: (fn) => fluent(tapErr(result, fn)),

  match: (onOk, onErr) => match(result, onOk, onErr),
  unwrapOr: (defaultValue) => unwrapOr(result, defaultValue),
  toResult: () => result,
  toString: () => show(result),
});

/** Opt-in dot chaining over {@link ResultAsync} */
export type FluentResultAsync<T, E> = {
  readonly resultAsync: ResultAsync<T, E>;
  map: <U>(fn: (value: T) => U) => FluentResultAsync<U, E>;
  mapErr: <F>(fn: (error: E) => F) => FluentResultAsync<T, F>;
  flatMap: <U, F = E>(
    fn: (value: T) => ResultAsync<U, F> | Result<U, F>,
  ) => FluentResultAsync<U, E | F>;
  andThen: <U, F = E>(
    fn: (value: T) => ResultAsync<U, F> | Result<U, F>,
  ) => FluentResultAsync<U, E | F>;
  recover: <F>(fn: (error: E) => ResultAsync<T, F> | Result<T, F>) => FluentResultAsync<T, F>;
  orElse: <F>(fn: (error: E) => ResultAsync<T, F> | Result<T, F>) => FluentResultAsync<T, F>;
  tap: (fn: (value: T) => void) => FluentResultAsync<T, E>;
  tapErr: (fn: (error: E) => void) => FluentResultAsync<T, E>;

  match: <U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2) => Promise<U1 | U2>;
  unwrapOr: <U>(defaultValue: U) => Promise<T | U>;
  resolve: () => Promise<Result<T, E>>;
};

/**
 * Wrap a {@link ResultAsync} for opt-in dot chaining — the async counterpart of
 * {@link fluent}. App-edge sugar; await a terminal (`match`, `unwrapOr`,
 * `resolve`) to leave the fluent world.
 *
 * @example
 * ```ts
 * fluentAsync(okAsync(2)).map((n) => n * 3); // FluentResultAsync<number, never>
 * ```
 */
export const fluentAsync = <T, E>(resultAsync: ResultAsync<T, E>): FluentResultAsync<T, E> => ({
  resultAsync,
  map: (fn) => fluentAsync(resultAsync.map(fn)),
  mapErr: (fn) => fluentAsync(resultAsync.mapErr(fn)),
  flatMap: (fn) => fluentAsync(resultAsync.flatMap(fn)),
  andThen: (fn) => fluentAsync(resultAsync.andThen(fn)),
  recover: (fn) => fluentAsync(resultAsync.recover(fn)),
  orElse: (fn) => fluentAsync(resultAsync.orElse(fn)),
  tap: (fn) => fluentAsync(resultAsync.tap(fn)),
  tapErr: (fn) => fluentAsync(resultAsync.tapErr(fn)),

  match: (onOk, onErr) => resultAsync.match(onOk, onErr),
  unwrapOr: (defaultValue) => resultAsync.unwrapOr(defaultValue),
  resolve: () => resultAsync.resolve(),
});
