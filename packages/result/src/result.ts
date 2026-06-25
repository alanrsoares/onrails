import type { Err, Ok, Result } from "./types.js";

export type { Err, Ok, Result } from "./types.js";

/**
 * Lifts a value into the success track.
 *
 * @example
 * ```ts
 * const r = ok(42);                          // Result<number, never>
 * const typed: Result<number, "parse"> = ok(1);
 * ```
 */
export const ok = <T, E = never>(value: T): Result<T, E> => ({
  _tag: "Ok",
  value,
});

/**
 * Lifts a value into the error track.
 *
 * @example
 * ```ts
 * const r = err({ kind: "parse", message: "bad json" });
 * // Result<never, { kind: "parse"; message: string }>
 * ```
 */
export const err = <T = never, E = unknown>(error: E): Result<T, E> => ({
  _tag: "Err",
  error,
});

/**
 * Type-narrowing predicate: returns `true` when the result is `Ok`.
 *
 * @example
 * ```ts
 * if (isOk(r)) {
 *   console.log(r.value);    // narrowed to Ok branch
 * }
 * ```
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result._tag === "Ok";

/**
 * Type-narrowing predicate: returns `true` when the result is `Err`.
 *
 * @example
 * ```ts
 * if (isErr(r)) {
 *   metrics.inc("error", { kind: r.error.kind });
 * }
 * ```
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => result._tag === "Err";

// ─────────────────────────────────────────────────────────────────────────────
// Dual-form helpers — each export accepts either shape:
//   data-first: `map(result, fn)`
//   curried:    `map(fn)(result)`
// Arity at the call site selects the overload.
// ─────────────────────────────────────────────────────────────────────────────

const mapImpl = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  isOk(result) ? ok(fn(result.value)) : err(result.error);

/**
 * Transform the `Ok` value, passing `Err` through unchanged. Dual-form:
 * call data-first or curried (for use with {@link pipe}).
 *
 * @example
 * ```ts
 * map(ok(2), (n) => n * 3);          // Ok 6 — data-first
 * pipe(ok("x"), map((s) => s.length));// Ok 1 — curried
 * ```
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
export function map<T, U>(fn: (value: T) => U): <E>(result: Result<T, E>) => Result<U, E>;
export function map(
  ...args: [Result<unknown, unknown>, (value: unknown) => unknown] | [(value: unknown) => unknown]
): unknown {
  if (args.length === 2) return mapImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => mapImpl(result, fn);
}

const mapErrImpl = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  isErr(result) ? err(fn(result.error)) : ok(result.value);

/**
 * Transform the `Err` value, passing `Ok` through unchanged. Useful for
 * unifying heterogeneous failure types into one app-level union.
 *
 * @example
 * ```ts
 * type AppError = { kind: "http"; status: number } | { kind: "parse" };
 * pipe(
 *   fetchSync(url),                                     // Result<Body, { status: number }>
 *   mapErr((e): AppError => ({ kind: "http", status: e.status })),
 * );
 * ```
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
export function mapErr<E, F>(fn: (error: E) => F): <T>(result: Result<T, E>) => Result<T, F>;
export function mapErr(
  ...args: [Result<unknown, unknown>, (error: unknown) => unknown] | [(error: unknown) => unknown]
): unknown {
  if (args.length === 2) return mapErrImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => mapErrImpl(result, fn);
}

const bimapImpl = <T, U, E, F>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => F,
): Result<U, F> => (isOk(result) ? ok(onOk(result.value)) : err(onErr(result.error)));

/**
 * Transform both tracks at once — `Ok` via `onOk`, `Err` via `onErr`.
 * Equivalent to `mapErr(onErr)(map(onOk)(result))` but in one pass.
 *
 * @example
 * ```ts
 * bimap(parsed, (cfg) => cfg.name, (e) => ({ kind: "input", cause: e }));
 * ```
 */
export function bimap<T, U, E, F>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => F,
): Result<U, F>;
export function bimap<T, U, E, F>(
  onOk: (value: T) => U,
  onErr: (error: E) => F,
): (result: Result<T, E>) => Result<U, F>;
export function bimap(
  ...args:
    | [Result<unknown, unknown>, (value: unknown) => unknown, (error: unknown) => unknown]
    | [(value: unknown) => unknown, (error: unknown) => unknown]
): unknown {
  if (args.length === 3) return bimapImpl(args[0], args[1], args[2]);
  const [onOk, onErr] = args;
  return (result: Result<unknown, unknown>) => bimapImpl(result, onOk, onErr);
}

const flatMapImpl = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (isOk(result) ? fn(result.value) : err(result.error));

/**
 * Canonical bind (Fantasy Land `chain`). Chains a Result-returning step,
 * widening the error union to `E | F`. Short-circuits on `Err`.
 *
 * @example
 * ```ts
 * flatMap(parseInput(raw), (data) =>
 *   data.id != null ? ok(data) : err({ kind: "missing_id" as const }),
 * );
 * // Result<Data, ParseError | { kind: "missing_id" }>
 * ```
 */
export function flatMap<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F>;
export function flatMap<T, U, F>(
  fn: (value: T) => Result<U, F>,
): <E>(result: Result<T, E>) => Result<U, E | F>;
export function flatMap(
  ...args:
    | [Result<unknown, unknown>, (value: unknown) => Result<unknown, unknown>]
    | [(value: unknown) => Result<unknown, unknown>]
): unknown {
  if (args.length === 2) return flatMapImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => flatMapImpl(result, fn);
}

const recoverImpl = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>,
): Result<T, F> => (isErr(result) ? fn(result.error) : ok(result.value));

/**
 * Error-track bind — runs `fn` only when the result is `Err`, allowing
 * a failed workflow to recover to `Ok` or remap the failure. Mirror of
 * {@link flatMap} on the error channel.
 *
 * @example
 * ```ts
 * recover(networkResult, (e) =>
 *   e.kind === "rate_limit" ? ok(cachedBody) : err(e),
 * );
 * ```
 */
export function recover<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>,
): Result<T, F>;
export function recover<T, E, F>(
  fn: (error: E) => Result<T, F>,
): (result: Result<T, E>) => Result<T, F>;
export function recover(
  ...args:
    | [Result<unknown, unknown>, (error: unknown) => Result<unknown, unknown>]
    | [(error: unknown) => Result<unknown, unknown>]
): unknown {
  if (args.length === 2) return recoverImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => recoverImpl(result, fn);
}

const tapImpl = <T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> => {
  if (isOk(result)) fn(result.value);
  return result;
};

/**
 * Observe the `Ok` value for side effects (logging, metrics) without
 * changing the carried value. Passes `Err` through untouched.
 *
 * @example
 * ```ts
 * pipe(
 *   parseConfig(raw),
 *   tap((cfg) => log.info({ msg: "parsed", name: cfg.name })),
 *   flatMap(validate),
 * );
 * ```
 */
export function tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E>;
export function tap<T>(fn: (value: T) => void): <E>(result: Result<T, E>) => Result<T, E>;
export function tap(
  ...args: [Result<unknown, unknown>, (value: unknown) => void] | [(value: unknown) => void]
): unknown {
  if (args.length === 2) return tapImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => tapImpl(result, fn);
}

const tapErrImpl = <T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> => {
  if (isErr(result)) fn(result.error);
  return result;
};

/**
 * Observe the `Err` value for side effects (logging, metrics) without
 * changing the carried error. Passes `Ok` through untouched.
 *
 * @example
 * ```ts
 * pipe(
 *   loadUser(id),
 *   tapErr((e) => metrics.inc("user.load.fail", { kind: e.kind })),
 * );
 * ```
 */
export function tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E>;
export function tapErr<E>(fn: (error: E) => void): <T>(result: Result<T, E>) => Result<T, E>;
export function tapErr(
  ...args: [Result<unknown, unknown>, (error: unknown) => void] | [(error: unknown) => void]
): unknown {
  if (args.length === 2) return tapErrImpl(args[0], args[1]);
  const fn = args[0];
  return (result: Result<unknown, unknown>) => tapErrImpl(result, fn);
}

const matchImpl = <T, E, U>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => U,
): U => (isOk(result) ? onOk(result.value) : onErr(result.error));

/**
 * Terminal collapse — fold both tracks into a single value. Dual-form:
 * 3-args data-first, 2-args curried for {@link pipe}. Returns whatever
 * the handlers return.
 *
 * For files that also import `match` from `ts-pattern`, use a namespace
 * import (`import * as R from "@onrails/result"` → `R.match`) to dissolve
 * the collision.
 *
 * @example
 * ```ts
 * const html = match(parsed, (cfg) => render(cfg), (e) => renderError(e));
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => U,
): U;
export function match<T, E, U>(
  onOk: (value: T) => U,
  onErr: (error: E) => U,
): (result: Result<T, E>) => U;
export function match(
  ...args:
    | [Result<unknown, unknown>, (value: unknown) => unknown, (error: unknown) => unknown]
    | [(value: unknown) => unknown, (error: unknown) => unknown]
): unknown {
  if (args.length === 3) return matchImpl(args[0], args[1], args[2]);
  const [onOk, onErr] = args;
  return (result: Result<unknown, unknown>) => matchImpl(result, onOk, onErr);
}

/**
 * Returns the `Ok` value, or `defaultValue` when the result is `Err`.
 *
 * @example
 * ```ts
 * unwrapOr(parsedSetting, "default-value");
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
export function unwrapOr<T>(defaultValue: T): <E>(result: Result<T, E>) => T;
export function unwrapOr(...args: [Result<unknown, unknown>, unknown] | [unknown]): unknown {
  if (args.length === 2) {
    const [result, defaultValue] = args;
    return isOk(result) ? result.value : defaultValue;
  }
  const defaultValue = args[0];
  return (result: Result<unknown, unknown>) => (isOk(result) ? result.value : defaultValue);
}

/**
 * Test/assert helper — returns the `Ok` value, or **throws the original `Err`
 * value** when called on an `Err`. This is the assertion tier (RFC 0001 §4):
 * intended for `*.spec.ts` / `*.test.ts`, where throwing fails the test loudly.
 * In business logic prefer {@link match} or {@link unwrapOr}; the lint plugins
 * flag `unwrapOk` outside test files.
 *
 * @returns the unwrapped `Ok` value
 * @throws the carried `Err` value when the result is `Err`
 *
 * @example
 * ```ts
 * // in a *.spec.ts
 * expect(unwrapOk(ok(5))).toBe(5);
 * expect(() => unwrapOk(err(error))).toThrow(error);
 * ```
 */
export function unwrapOk<T, E>(result: Result<T, E>): T {
  if (isErr(result)) throw result.error;
  return result.value;
}

/** Alias of {@link unwrapOk} for syntax cohesion with `@onrails/maybe`. */
export const unwrap = unwrapOk;

/**
 * Test/assert helper — returns the `Err` value, or **throws a `TypeError`**
 * when called on an `Ok`. Mirror of {@link unwrapOk} on the error track and
 * part of the same assertion tier (RFC 0001 §4): intended for `*.spec.ts` /
 * `*.test.ts`. Prefer {@link match} / {@link unwrapOr} in business logic; the
 * lint plugins flag `unwrapErr` outside test files.
 *
 * @returns the unwrapped `Err` value
 * @throws `TypeError` when the result is `Ok`
 *
 * @example
 * ```ts
 * // in a *.spec.ts
 * expect(unwrapErr(err("x"))).toBe("x");
 * expect(() => unwrapErr(ok(5))).toThrow(TypeError);
 * ```
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isOk(result)) throw new TypeError("unwrapErr called on Ok");
  return result.error;
}

/**
 * Wraps a throwing sync function, returning a function that produces a
 * {@link Result} instead of throwing. Thrown errors pass through `onThrow` to
 * become a typed `Err`; a normal return becomes `Ok`. The neverthrow analogue
 * is `Result.fromThrowable`.
 *
 * @param fn - the throwing function to wrap
 * @param onThrow - maps a thrown value to the `Err` channel
 * @returns a function with `fn`'s parameters that returns `Result<ReturnType, E>`
 *
 * @example
 * ```ts
 * type ParseError = { kind: "parse"; message: string };
 * const parse = trySync(
 *   JSON.parse,
 *   (e): ParseError => ({ kind: "parse", message: String(e) }),
 * );
 * parse("{}");      // Ok({})
 * parse("nope");    // Err({ kind: "parse", … })
 * ```
 */
export function trySync<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onThrow: (error: unknown) => E,
): (...args: A) => Result<T, E>;
export function trySync<F extends (...args: never) => unknown, E>(
  fn: F,
  onThrow: (error: unknown) => E,
): (...args: Parameters<F>) => Result<ReturnType<F>, E>;
export function trySync(
  fn: (...args: never) => unknown,
  onThrow: (error: unknown) => unknown,
): (...args: never) => Result<unknown, unknown> {
  return (...args: never) => {
    try {
      return ok(fn(...args));
    } catch (error) {
      return err(onThrow(error));
    }
  };
}

/**
 * Variadic value-first pipe — threads `value` through up to nine unary fns,
 * left-to-right. Use {@link pipe} when you already have a starting value;
 * use {@link flow} to define a reusable composed function with no value yet.
 *
 * @example
 * ```ts
 * pipe(
 *   parseConfig(raw),
 *   map((cfg) => cfg.name),
 *   flatMap((name) => (name ? ok(name) : err({ kind: "empty" as const }))),
 *   tap(log),
 * );
 * ```
 */
export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(value: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(value: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
export function pipe<A, B, C, D, E>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
  value: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): I;
export function pipe(value: unknown, ...fns: ReadonlyArray<(x: unknown) => unknown>): unknown {
  let acc = value;
  for (const fn of fns) {
    acc = fn(acc);
  }
  return acc;
}
