import type { ResultAsync } from "./async.js";
import { flatMap, map, mapErr, match, unwrapOr } from "./result.js";
import type { Result } from "./types.js";

/** Opt-in dot chaining over a sync {@link Result} */
export type FluentResult<T, E> = {
  readonly result: Result<T, E>;
  map: <U>(fn: (value: T) => U) => FluentResult<U, E>;
  mapErr: <F>(fn: (error: E) => F) => FluentResult<T, F>;
  flatMap: <U>(fn: (value: T) => Result<U, E>) => FluentResult<U, E>;
  andThen: <U>(fn: (value: T) => Result<U, E>) => FluentResult<U, E>;
  /** @deprecated Use {@link flatMap} or compat {@link andThen} instead. */
  chain: <U>(fn: (value: T) => Result<U, E>) => FluentResult<U, E>;
  match: <U>(onOk: (value: T) => U, onErr: (error: E) => U) => U;
  unwrapOr: (defaultValue: T) => T;
};

export const fluent = <T, E>(result: Result<T, E>): FluentResult<T, E> => ({
  result,
  map: (fn) => fluent(map(result, fn)),
  mapErr: (fn) => fluent(mapErr(result, fn)),
  flatMap: (fn) => fluent(flatMap(result, fn)),
  andThen: (fn) => fluent(flatMap(result, fn)),
  chain: (fn) => fluent(flatMap(result, fn)),
  match: (onOk, onErr) => match(onOk, onErr)(result),
  unwrapOr: (defaultValue) => unwrapOr(result, defaultValue),
});

/** Opt-in dot chaining over {@link ResultAsync} */
export type FluentResultAsync<T, E> = {
  readonly resultAsync: ResultAsync<T, E>;
  map: <U>(fn: (value: T) => U) => FluentResultAsync<U, E>;
  mapErr: <F>(fn: (error: E) => F) => FluentResultAsync<T, F>;
  flatMap: <U>(fn: (value: T) => ResultAsync<U, E>) => FluentResultAsync<U, E>;
  andThen: <U>(fn: (value: T) => ResultAsync<U, E>) => FluentResultAsync<U, E>;
  /** @deprecated Use {@link flatMap} or compat {@link andThen} instead. */
  chain: <U>(fn: (value: T) => ResultAsync<U, E>) => FluentResultAsync<U, E>;
  match: <U>(onOk: (value: T) => U, onErr: (error: E) => U) => Promise<U>;
};

export const fluentAsync = <T, E>(resultAsync: ResultAsync<T, E>): FluentResultAsync<T, E> => ({
  resultAsync,
  map: (fn) => fluentAsync(resultAsync.map(fn)),
  mapErr: (fn) => fluentAsync(resultAsync.mapErr(fn)),
  flatMap: (fn) => fluentAsync(resultAsync.flatMap(fn)),
  andThen: (fn) => fluentAsync(resultAsync.andThen(fn)),
  chain: (fn) => fluentAsync(resultAsync.chain(fn)),
  match: (onOk, onErr) => resultAsync.match(onOk, onErr),
});
