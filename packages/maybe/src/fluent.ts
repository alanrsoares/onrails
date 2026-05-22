import {
  andThen,
  flatMapMaybe,
  getOrElse,
  type Maybe,
  mapMaybe,
  match,
  unwrapOr,
} from "./maybe.js";

export type FluentMaybe<T> = Maybe<T> & {
  map<U>(fn: (value: T) => U): FluentMaybe<U>;
  flatMap<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  andThen<U>(fn: (value: T) => Maybe<U>): FluentMaybe<U>;
  match<U>(handlers: { some: (value: T) => U; none: () => U }): U;
  getOrElse(defaultValue: T): T;
  unwrapOr(defaultValue: T): T;
};

export const fluent = <T>(maybe: Maybe<T>): FluentMaybe<T> =>
  Object.assign(maybe, {
    map<U>(fn: (value: T) => U) {
      return fluent(mapMaybe(maybe, fn));
    },
    flatMap<U>(fn: (value: T) => Maybe<U>) {
      return fluent(flatMapMaybe(maybe, fn));
    },
    andThen<U>(fn: (value: T) => Maybe<U>) {
      return fluent(andThen(maybe, fn));
    },
    match<U>(handlers: { some: (value: T) => U; none: () => U }) {
      return match(maybe, handlers);
    },
    getOrElse(defaultValue: T) {
      return getOrElse(maybe, defaultValue);
    },
    unwrapOr(defaultValue: T) {
      return unwrapOr(maybe, defaultValue);
    },
  });
