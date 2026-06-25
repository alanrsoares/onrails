import { andThen, flatMap, type Maybe, map, match, tap, tapNone, unwrapOr } from "./maybe.js";

/** Opt-in dot chaining over a {@link Maybe}. */
export type FluentMaybe<T> = {
  readonly maybe: Maybe<T>;
  map<U>(fn: (value: T) => U): FluentMaybe<U>;
  flatMap<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  andThen<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  tap(fn: (value: T) => void): FluentMaybe<T>;
  tapNone(fn: () => void): FluentMaybe<T>;
  match<U>(onSome: (value: T) => U, onNone: () => U): U;

  unwrapOr(defaultValue: T): T;
};

/**
 * Wrap a {@link Maybe} for opt-in dot chaining — app-edge sugar. Keep the
 * data-first helpers ({@link map}, {@link flatMap}) in library internals.
 *
 * @example
 * ```ts
 * fluent(some(2)).map((n) => n * 3).unwrapOr(0); // 6
 * ```
 */
export const fluent = <T>(maybe: Maybe<T>): FluentMaybe<T> => ({
  maybe,
  map: (fn) => fluent(map(maybe, fn)),
  flatMap: (fn) => fluent(flatMap(maybe, fn)),
  tap: (fn) => fluent(tap(maybe, fn)),
  tapNone: (fn) => fluent(tapNone(maybe, fn)),
  andThen: (fn) => fluent(andThen(maybe, fn)),
  match: (onSome, onNone) => match(maybe, onSome, onNone),

  unwrapOr: (defaultValue) => unwrapOr(maybe, defaultValue),
});
