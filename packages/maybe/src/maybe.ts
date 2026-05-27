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

// ─────────────────────────────────────────────────────────────────────────────
// Dual-form helpers — each accepts either shape:
//   data-first: `map(maybe, fn)`
//   curried:    `map(fn)(maybe)`
// ─────────────────────────────────────────────────────────────────────────────

const mapImpl = <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> =>
  isSome(maybe) ? some(fn(maybe.value)) : none<U>();

export function map<T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U>;
export function map<T, U>(fn: (value: T) => U): (maybe: Maybe<T>) => Maybe<U>;
export function map(
  ...args: [Maybe<unknown>, (value: unknown) => unknown] | [(value: unknown) => unknown]
): unknown {
  if (args.length === 2) return mapImpl(args[0], args[1]);
  const fn = args[0];
  return (maybe: Maybe<unknown>) => mapImpl(maybe, fn);
}

const flatMapImpl = <T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U> =>
  isSome(maybe) ? fn(maybe.value) : none<U>();

export function flatMap<T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U>;
export function flatMap<T, U>(fn: (value: T) => Maybe<U>): (maybe: Maybe<T>) => Maybe<U>;
export function flatMap(
  ...args:
    | [Maybe<unknown>, (value: unknown) => Maybe<unknown>]
    | [(value: unknown) => Maybe<unknown>]
): unknown {
  if (args.length === 2) return flatMapImpl(args[0], args[1]);
  const fn = args[0];
  return (maybe: Maybe<unknown>) => flatMapImpl(maybe, fn);
}

/** Alias for {@link flatMap} — same dual-form shape. */
export const andThen = flatMap;

const matchImpl = <T, U>(maybe: Maybe<T>, onSome: (value: T) => U, onNone: () => U): U =>
  isSome(maybe) ? onSome(maybe.value) : onNone();

export function match<T, U>(maybe: Maybe<T>, onSome: (value: T) => U, onNone: () => U): U;
export function match<T, U>(onSome: (value: T) => U, onNone: () => U): (maybe: Maybe<T>) => U;
export function match(
  ...args:
    | [Maybe<unknown>, (value: unknown) => unknown, () => unknown]
    | [(value: unknown) => unknown, () => unknown]
): unknown {
  if (args.length === 3) return matchImpl(args[0], args[1], args[2]);
  const [onSome, onNone] = args;
  return (maybe: Maybe<unknown>) => matchImpl(maybe, onSome, onNone);
}

/** Collision-free alias — mirrors `matchResult` on `@onrails/result`. */
export const matchMaybe = match;

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
  flatMapImpl(fromNullable(value), fn);
