import {
  andThen,
  flatMap,
  getOrElse,
  type Maybe,
  map,
  match,
  tap,
  tapNone,
  unwrapOr,
} from "./maybe.js";

export type FluentMaybe<T> = Maybe<T> & {
  map<U>(fn: (value: T) => U): FluentMaybe<U>;
  flatMap<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  andThen<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  tap(fn: (value: T) => void): FluentMaybe<T>;
  tapNone(fn: () => void): FluentMaybe<T>;
  match<U>(onSome: (value: T) => U, onNone: () => U): U;
  getOrElse(defaultValue: T): T;
  unwrapOr(defaultValue: T): T;
};

export const fluent = <T>(maybe: Maybe<T>): FluentMaybe<T> =>
  Object.assign(maybe, {
    map<U>(fn: (value: T) => U) {
      return fluent(map(maybe, fn));
    },
    flatMap<U>(fn: (value: T) => Maybe<U>) {
      return fluent(flatMap(maybe, fn));
    },
    tap(fn: (value: T) => void) {
      return fluent(tap(maybe, fn));
    },
    tapNone(fn: () => void) {
      return fluent(tapNone(maybe, fn));
    },
    andThen<U>(fn: (value: T) => Maybe<U>) {
      return fluent(andThen(maybe, fn));
    },
    match<U>(onSome: (value: T) => U, onNone: () => U) {
      return match(maybe, onSome, onNone);
    },
    getOrElse(defaultValue: T) {
      return getOrElse(maybe, defaultValue);
    },
    unwrapOr(defaultValue: T) {
      return unwrapOr(maybe, defaultValue);
    },
  });
