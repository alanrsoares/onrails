import { dual } from "./internal/dual.js";

/**
 * Tagged optional value — a discriminated union over `_tag` where absence
 * (`None`) is an expected outcome, not a failure. Construct with {@link some} /
 * {@link none}, narrow with {@link isSome} / {@link isNone}, and collapse with
 * {@link match}.
 *
 * @example
 * ```ts
 * function findUser(id: string): Maybe<User> {
 *   return fromNullable(db.users.get(id));
 * }
 * ```
 */
export type Maybe<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };

/** The `Some` branch of a {@link Maybe} — a present value tagged `"Some"`. */
export type Some<T> = Extract<Maybe<T>, { _tag: "Some" }>;

/** The `None` branch of a {@link Maybe} — expected absence, tagged `"None"`. */
export type None = Extract<Maybe<never>, { _tag: "None" }>;

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
 * Fantasy Land `pure` — alias of {@link some}. One lift name shared across
 * the trio (`of` / `Result.of` / `ResultAsync.of`) for generic and FL-style
 * code.
 *
 * @example
 * ```ts
 * const m = of(1);   // Maybe<number> — identical to some(1)
 * ```
 */
export const of = some;

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
 * fromNullable(cache.get(key));   // Maybe<V>
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
export const map: {
  <T, U>(maybe: Maybe<T>, fn: (value: T) => U): Maybe<U>;
  <T, U>(fn: (value: T) => U): (maybe: Maybe<T>) => Maybe<U>;
} = dual(2, mapImpl);

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
export const flatMap: {
  <T, U>(maybe: Maybe<T>, fn: (value: T) => Maybe<U>): Maybe<U>;
  <T, U>(fn: (value: T) => Maybe<U>): (maybe: Maybe<T>) => Maybe<U>;
} = dual(2, flatMapImpl);

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
export const match: {
  <T, U>(maybe: Maybe<T>, onSome: (value: T) => U, onNone: () => U): U;
  <T, U>(onSome: (value: T) => U, onNone: () => U): (maybe: Maybe<T>) => U;
} = dual(3, matchImpl);

const unwrapOrImpl = <T>(maybe: Maybe<T>, defaultValue: T): T =>
  isSome(maybe) ? maybe.value : defaultValue;

export const unwrapOr: {
  <T>(maybe: Maybe<T>, defaultValue: T): T;
  <T>(defaultValue: T): (maybe: Maybe<T>) => T;
} = dual(2, unwrapOrImpl);

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
export const tap: {
  <T>(maybe: Maybe<T>, fn: (value: T) => void): Maybe<T>;
  <T>(fn: (value: T) => void): (maybe: Maybe<T>) => Maybe<T>;
} = dual(2, tapImpl);

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
export const tapNone: {
  <T>(maybe: Maybe<T>, fn: () => void): Maybe<T>;
  <T>(fn: () => void): (maybe: Maybe<T>) => Maybe<T>;
} = dual(2, tapNoneImpl);

const printPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload) ?? String(payload);
  } catch {
    // cyclic or non-JSON payload — a debug printer must not throw
    return String(payload);
  }
};

/**
 * Debug printer — renders a maybe as `Some(…)` / `None` for logs. Payloads
 * print as JSON (values are plain data by design); non-JSON payloads fall
 * back to `String(...)`. Mirror of the result package's `show`.
 *
 * @example
 * ```ts
 * show(some(1));   // 'Some(1)'
 * show(none());    // 'None'
 * ```
 */
export const show = <T>(maybe: Maybe<T>): string =>
  isSome(maybe) ? `Some(${printPayload(maybe.value)})` : "None";
