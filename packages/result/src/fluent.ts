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
