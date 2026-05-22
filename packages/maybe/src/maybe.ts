import type { Maybe, None, Some } from "./types.js";

export type { Maybe, None, Some } from "./types.js";

export const some = <T>(value: T): Maybe<T> => ({ _tag: "Some", value });

/** Fantasy Land `of` */
export const of = some;

export const none = <T = never>(): Maybe<T> => ({ _tag: "None" });

export const isSome = <T>(maybe: Maybe<T>): maybe is Some<T> => maybe._tag === "Some";

export const isNone = <T>(maybe: Maybe<T>): maybe is None => maybe._tag === "None";

export const fromNullable = <T>(value: T | null | undefined): Maybe<T> =>
  value == null ? none<T>() : some(value);

export const fromThrowable = <T>(fn: () => T): Maybe<T> => {
  try {
    return some(fn());
  } catch {
    return none<T>();
  }
};

export const mapMaybe = <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> => {
  if (isSome(maybe)) {
    return some(fn(maybe.value));
  }
  return none<U>();
};

export const map =
  <T, U>(fn: (value: T) => U) =>
  (maybe: Maybe<T>): Maybe<U> =>
    mapMaybe(maybe, fn);

export const flatMapMaybe = <T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U> => {
  if (isSome(maybe)) {
    return fn(maybe.value);
  }
  return none<U>();
};

export const flatMap =
  <T, U>(fn: (value: T) => Maybe<U>) =>
  (maybe: Maybe<T>): Maybe<U> =>
    flatMapMaybe(maybe, fn);

/** Alias — mirrors {@link flatMapMaybe} on `@onrails/result` */
export const andThen = flatMapMaybe;

export const match = <T, U>(
  maybe: Maybe<T>,
  handlers: { some: (value: T) => U; none: () => U },
): U => (isSome(maybe) ? handlers.some(maybe.value) : handlers.none());

/** @deprecated Use {@link match} */
export const matchMaybe = match;

export const matchWith =
  <T, U>(handlers: { some: (value: T) => U; none: () => U }) =>
  (maybe: Maybe<T>): U =>
    match(maybe, handlers);

export const getOrElse = <T>(maybe: Maybe<T>, defaultValue: T): T =>
  isSome(maybe) ? maybe.value : defaultValue;

/** Alias — mirrors `@onrails/result` {@link unwrapOr} */
export const unwrapOr = getOrElse;

export const unwrap = <T>(maybe: Maybe<T>): T => {
  if (isNone(maybe)) {
    throw new Error("Called unwrap on None");
  }
  return maybe.value;
};

export const compact = <T>(maybes: readonly Maybe<T>[]): T[] => {
  const out: T[] = [];
  for (const m of maybes) {
    if (isSome(m)) {
      out.push(m.value);
    }
  }
  return out;
};

/** `compact(items.map(fn))` — map to Maybe, drop None. */
export const compactMap = <T, U>(items: readonly T[], fn: (item: T) => Maybe<U>): U[] =>
  compact(items.map(fn));

/** `flatMapMaybe(fromNullable(value), fn)` — lift nullable then bind. */
export const optional = <T, U>(value: T | null | undefined, fn: (value: T) => Maybe<U>): Maybe<U> =>
  flatMapMaybe(fromNullable(value), fn);
