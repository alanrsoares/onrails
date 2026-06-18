import type { Maybe, None, Some } from "./types.js";

export type { Maybe, None, Some } from "./types.js";

/**
 * Lifts a value into the `Some` branch.
 *
 * @example
 * ```ts
 * const m = some(1);   // Maybe<number>
 * ```
 */
export const some = <T>(value: T): Maybe<T> => ({ _tag: "Some", value });

/**
 * The `None` value — represents expected absence. Not a failure.
 *
 * @example
 * ```ts
 * const cached: Maybe<User> = cache.has(id) ? some(cache.get(id)) : none();
 * ```
 */
export const none = <T = never>(): Maybe<T> => ({ _tag: "None" });

/**
 * Type-narrowing predicate: returns `true` when the value is `Some`.
 *
 * @example
 * ```ts
 * if (isSome(m)) {
 *   console.log(m.value);   // narrowed to Some branch
 * }
 * ```
 */
export const isSome = <T>(maybe: Maybe<T>): maybe is Some<T> => maybe._tag === "Some";

/**
 * Type-narrowing predicate: returns `true` when the value is `None`.
 *
 * @example
 * ```ts
 * if (isNone(fromNullable(user))) {
 *   return redirect("/login");   // narrowed to None branch
 * }
 * ```
 */
export const isNone = <T>(maybe: Maybe<T>): maybe is None => maybe._tag === "None";

/**
 * Lift a nullable value into `Maybe<T>` — `null` and `undefined` become
 * `None`; anything else becomes `Some`.
 *
 * @example
 * ```ts
 * fromNullable(map.get(key));     // Maybe<V>
 * fromNullable(null);             // None
 * ```
 */
export const fromNullable = <T>(value: T | null | undefined): Maybe<T> =>
  value == null ? none<T>() : some(value);

// ─────────────────────────────────────────────────────────────────────────────
// Dual-form helpers — each accepts either shape:
//   data-first: `map(maybe, fn)`
//   curried:    `map(fn)(maybe)`
// ─────────────────────────────────────────────────────────────────────────────

const mapImpl = <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U> =>
  isSome(maybe) ? some(fn(maybe.value)) : none<U>();

/**
 * Transform the `Some` value, passing `None` through unchanged. Dual-form.
 *
 * @example
 * ```ts
 * map(some(2), (n) => n * 3);                      // Some 6 — data-first
 * pipe(fromNullable(input), map((s) => s.trim())); // curried
 * ```
 */
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

/**
 * Canonical bind for `Maybe`. Chains a `Maybe`-returning step;
 * short-circuits on `None`. Dual-form.
 *
 * @example
 * ```ts
 * flatMap(fromNullable(user), (u) =>
 *   u.active ? some(u) : none(),
 * );
 * ```
 */
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

/**
 * Neverthrow-compat alias of {@link flatMap} — same dual-form shape. Prefer
 * {@link flatMap} as the canonical name; reach for `andThen` only when porting
 * neverthrow code or matching its vocabulary.
 *
 * @example
 * ```ts
 * andThen(fromNullable(user), (u) =>
 *   u.active ? some(u) : none(),
 * );
 * ```
 */
export const andThen = flatMap;

const matchImpl = <T, U>(maybe: Maybe<T>, onSome: (value: T) => U, onNone: () => U): U =>
  isSome(maybe) ? onSome(maybe.value) : onNone();

/**
 * Terminal collapse — fold both branches into a single value. Positional,
 * dual-form. Same shape as `Result.match` for sibling consistency.
 *
 * For files that also import `match` from `ts-pattern`, use a namespace
 * import (`import * as Maybe from "@onrails/maybe"` → `Maybe.match`) to
 * dissolve the collision.
 *
 * @example
 * ```ts
 * const greeting = match(
 *   fromNullable(user),
 *   (u) => `hello ${u.name}`,
 *   () => "hello guest",
 * );
 * ```
 */
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

/**
 * Returns the `Some` value, or `defaultValue` when the value is `None`.
 *
 * @example
 * ```ts
 * unwrapOr(fromNullable(user), { name: "guest" });
 * ```
 */
export const unwrapOr = <T>(maybe: Maybe<T>, defaultValue: T): T =>
  isSome(maybe) ? maybe.value : defaultValue;

/**
 * Unwraps the `Some` value or throws if the value is `None`.
 *
 * @throws when the value is None — assertion-tier; use {@link match} / {@link unwrapOr} in business logic.
 * Allowed in `*.spec.ts` / `*.test.ts`; flagged elsewhere by the plugins.
 *
 * @example
 * ```ts
 * expect(unwrap(parseUser(raw))).toEqual(expected);
 * ```
 */
export const unwrap = <T>(maybe: Maybe<T>): T => {
  if (isNone(maybe)) {
    throw new Error("Called unwrap on None");
  }
  return maybe.value;
};

/**
 * Drop every `None` and collect the remaining `Some` values into an array.
 *
 * @example
 * ```ts
 * compact([some(1), none(), some(2)]);    // [1, 2]
 * ```
 */
export const compact = <T>(maybes: readonly Maybe<T>[]): T[] => {
  const out: T[] = [];
  for (const m of maybes) {
    if (isSome(m)) {
      out.push(m.value);
    }
  }
  return out;
};

/**
 * `compact(items.map(fn))` — map each item to `Maybe`, drop `None`,
 * collect the rest.
 *
 * @example
 * ```ts
 * compactMap(rawRows, (row) =>
 *   row.deletedAt ? none() : some(row.id),
 * );
 * // string[]
 * ```
 */
export const compactMap = <T, U>(items: readonly T[], fn: (item: T) => Maybe<U>): U[] =>
  compact(items.map(fn));

/**
 * `flatMap(fromNullable(value), fn)` — lift a nullable then bind through
 * a `Maybe`-returning step. Convenient for chaining lookups.
 *
 * @example
 * ```ts
 * optional(rawId, (id) => fromNullable(cache.get(id)));
 * ```
 */
export const optional = <T, U>(value: T | null | undefined, fn: (value: T) => Maybe<U>): Maybe<U> =>
  flatMapImpl(fromNullable(value), fn);

const tapImpl = <T>(maybe: Maybe<T>, fn: (value: T) => void): Maybe<T> => {
  if (isSome(maybe)) fn(maybe.value);
  return maybe;
};

/**
 * Run a side effect on the `Some` value, pass the `Maybe` through unchanged.
 * `None` is a no-op. Mirrors `tap` from `@onrails/result`. Dual-form.
 *
 * @example
 * ```ts
 * tap(some(2), (n) => console.log(n));               // logs 2, returns Some 2
 * pipe(fromNullable(row), tap((r) => sink.push(r))); // curried — collect on Some
 * ```
 */
export function tap<T>(maybe: Maybe<T>, fn: (value: T) => void): Maybe<T>;
export function tap<T>(fn: (value: T) => void): (maybe: Maybe<T>) => Maybe<T>;
export function tap(
  ...args: [Maybe<unknown>, (value: unknown) => void] | [(value: unknown) => void]
): unknown {
  if (args.length === 2) return tapImpl(args[0], args[1]);
  const fn = args[0];
  return (maybe: Maybe<unknown>) => tapImpl(maybe, fn);
}

const tapNoneImpl = <T>(maybe: Maybe<T>, fn: () => void): Maybe<T> => {
  if (isNone(maybe)) fn();
  return maybe;
};

/**
 * Run a side effect when the `Maybe` is `None`, pass it through unchanged.
 * `Some` is a no-op. The `None`-side mirror of {@link tap}. Dual-form.
 *
 * @example
 * ```ts
 * tapNone(none(), () => metrics.miss());              // runs effect, returns None
 * pipe(fromNullable(hit), tapNone(() => metrics.miss())); // curried
 * ```
 */
export function tapNone<T>(maybe: Maybe<T>, fn: () => void): Maybe<T>;
export function tapNone<T>(fn: () => void): (maybe: Maybe<T>) => Maybe<T>;
export function tapNone(...args: [Maybe<unknown>, () => void] | [() => void]): unknown {
  if (args.length === 2) return tapNoneImpl(args[0], args[1]);
  const fn = args[0];
  return (maybe: Maybe<unknown>) => tapNoneImpl(maybe, fn);
}
