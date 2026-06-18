import type { ExhaustiveResult, ExhaustMatched } from "./exhaustive.js";
import type { Narrow, NarrowUnion } from "./narrow.js";

/**
 * A pattern that matches a value of type `T`. One of:
 *
 * - **Literal** — a primitive (`"a"`, `42`, `true`) matched by `===`.
 * - **Object pattern** — a `Partial<T>` of shallow key/value pairs that
 *   must all match by strict equality. Only available when `T` is an
 *   object type.
 * - **Guard** — a function `(input: T) => boolean`. Type predicates
 *   (`(x): x is U`) narrow the handler input via {@link Narrow}.
 *
 * @example
 * ```ts
 * type Event = { kind: "click"; x: number; y: number } | { kind: "key"; code: string };
 *
 * const p1: Pattern<Event> = { kind: "click" };         // object pattern
 * const p2: Pattern<Event> = (e) => e.kind === "key";   // guard
 * ```
 */
export type Pattern<T> = T | ObjectPattern<T> | PatternGuard<T>;

// Shallow partial of `T`; restricted to object types so primitive `T`
// (e.g. `number | string`) does not pick up `Record<string, unknown>`
// as a candidate pattern and pollute `Narrow<T, P>` via distribution.
type ObjectPattern<T> = T extends object ? Partial<T> : never;

type PatternGuard<T> = (input: T) => boolean;

type Case<T, R> = {
  readonly test: (input: T) => boolean;
  readonly run: (input: T) => R;
};

const isGuard = <T>(pattern: Pattern<T>): pattern is PatternGuard<T> =>
  typeof pattern === "function";

const isPatternObject = (pattern: unknown): pattern is Record<string, unknown> =>
  typeof pattern === "object" && pattern !== null;

const matches = <T>(input: T, pattern: Pattern<T>): boolean => {
  if (isGuard(pattern)) {
    return pattern(input);
  }
  if (!isPatternObject(pattern)) {
    return input === pattern;
  }
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  const patternRecord = pattern as Record<string, unknown>;
  for (const key of Object.keys(patternRecord)) {
    if (record[key] !== patternRecord[key]) {
      return false;
    }
  }
  return true;
};

// Sentinel for "no case matched". Distinct from a handler legitimately
// returning `undefined` (e.g. side-effect-only handlers), which would
// otherwise be misreported as non-exhaustive.
const NO_MATCH = Symbol("@onrails/pattern/no-match");
type NoMatch = typeof NO_MATCH;

// Sentinel for "curried matcher, no captured input". Distinct from a
// data-first `match(undefined)` / `match(null)`, which must run immediately
// like any other value instead of silently degrading to curried mode.
const NO_INPUT = Symbol("@onrails/pattern/no-input");
type NoInput = typeof NO_INPUT;

const runCases = <T, R>(input: T, cases: readonly Case<T, R>[]): R | NoMatch => {
  for (const c of cases) {
    if (c.test(input)) {
      return c.run(input);
    }
  }
  return NO_MATCH;
};

const caseForPatterns = <T, R>(
  patterns: readonly Pattern<T>[],
  handler: (input: T) => R,
): Case<T, R> => ({
  test: (input) => patterns.some((pattern) => matches(input, pattern)),
  run: handler,
});

// Result-type accumulator: stays at `R` when the result type is locked
// (after `returnType<R>()`), otherwise widens with each `.with`.
type NextResult<Locked extends boolean, R, R2> = Locked extends true ? R : R | R2;

// Handler return-type constraint: when locked, every handler must return `R`;
// when open, the handler can return any type and the result widens to include it.
type HandlerReturn<Locked extends boolean, R, R2> = Locked extends true ? R : R2;

/**
 * Fluent builder for {@link match}. Tracks the handled cases at the type
 * level so `.exhaustive()` only compiles when every union member is covered.
 *
 * The `Locked` phantom flag (set via `.returnType<R>()`) constrains every
 * subsequent handler to return `R`, useful when branch return-type
 * inference would widen to a union narrower than the target slot
 * (e.g. `ReactNode`, an API DTO).
 *
 * @example
 * ```ts
 * const describe = match<Event>()
 *   .with({ kind: "click" }, (e) => `click @ ${e.x},${e.y}`)
 *   .with({ kind: "key" },   (e) => `key ${e.code}`)
 *   .exhaustive();
 * ```
 */
export class MatchBuilder<
  T,
  R = never,
  HasInput extends boolean = false,
  Handled extends readonly unknown[] = [],
  Locked extends boolean = false,
> {
  /**
   * Construct a builder directly. Prefer the {@link match} factory — the
   * constructor exists so internal combinators can thread accumulated `cases`,
   * the optional captured `input`, and the phantom `_handled` tuple.
   */
  constructor(
    private readonly cases: readonly Case<T, unknown>[],
    // No default: `= NO_INPUT` would swallow a data-first `undefined` input,
    // because JS applies parameter defaults to explicitly-passed undefined.
    private readonly input: T | NoInput,
    /** Phantom tuple of handled cases — only its compile-time contents matter. */
    readonly _handled: Handled = [] as unknown as Handled,
  ) {}

  /** Appends a runtime case plus a phantom `H` entry on the handled tuple. */
  private addCase<R2, H>(
    next: Case<T, unknown>,
  ): MatchBuilder<T, NextResult<Locked, R, R2>, HasInput, readonly [...Handled, H], Locked> {
    return new MatchBuilder(
      [...this.cases, next],
      this.input,
      // Safe: _handled is a phantom tuple — only its type-level contents matter.
      this._handled as unknown as readonly [...Handled, H],
    );
  }

  /**
   * Add a case: when `input` satisfies `pattern`, run `handler` on the narrowed
   * value. The pattern may be a literal, a shallow object pattern, or a guard
   * ({@link Pattern}); a type-predicate guard narrows the handler input. Each
   * `.with` advances compile-time exhaustiveness tracking so `.exhaustive()`
   * knows which union members remain.
   *
   * @param pattern - literal, object pattern, or guard to test against
   * @param handler - run on the narrowed input when the pattern matches
   * @returns a builder with this case appended
   *
   * @example
   * ```ts
   * type Event =
   *   | { type: "message"; content: string }
   *   | { type: "error"; message: string }
   *   | { type: "done" };
   *
   * const summary = match({ type: "message", content: "hi" } as Event)
   *   .with({ type: "message" }, (e) => e.content)   // e: { type: "message"; content: string }
   *   .with({ type: "error" },   (e) => e.message)
   *   .with({ type: "done" },    () => "—")
   *   .exhaustive();                                 // "hi"
   * ```
   */
  with<const P extends Pattern<T>, R2>(
    pattern: P,
    handler: (input: Narrow<T, P>) => HandlerReturn<Locked, R, R2>,
  ): MatchBuilder<
    T,
    NextResult<Locked, R, R2>,
    HasInput,
    readonly [...Handled, ExhaustMatched<T, P>],
    Locked
  > {
    return this.addCase<R2, ExhaustMatched<T, P>>({
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => unknown,
    });
  }

  /**
   * One handler for several patterns (OR). The handler input is the union of
   * the members narrowed by each pattern, and all of them are marked handled
   * for exhaustiveness.
   *
   * @param patterns - patterns to test; any match runs `handler`
   * @param handler - run on the union of narrowed members
   * @returns a builder with the shared case appended
   *
   * @example
   * ```ts
   * type Job =
   *   | { kind: "queued"; id: string }
   *   | { kind: "running"; id: string }
   *   | { kind: "done"; ok: boolean };
   *
   * const status = match({ kind: "running", id: "j1" } as Job)
   *   .withOneOf([{ kind: "queued" }, { kind: "running" }], (j) => j.id) // j: queued | running
   *   .with({ kind: "done" }, (j) => (j.ok ? "yes" : "no"))
   *   .exhaustive();                                                      // "j1"
   * ```
   */
  withOneOf<const Ps extends readonly Pattern<T>[], R2>(
    patterns: Ps,
    handler: (input: NarrowUnion<T, Ps>) => HandlerReturn<Locked, R, R2>,
  ): MatchBuilder<
    T,
    NextResult<Locked, R, R2>,
    HasInput,
    readonly [...Handled, NarrowUnion<T, Ps>],
    Locked
  > {
    return this.addCase<R2, NarrowUnion<T, Ps>>(
      caseForPatterns(patterns, handler as (input: T) => unknown),
    );
  }

  /**
   * {@link withOneOf} for exactly two patterns — sugar that avoids the array.
   *
   * @param pattern1 - first pattern
   * @param pattern2 - second pattern
   * @param handler - run on the union of the two narrowed members
   * @returns a builder with the shared case appended
   *
   * @example
   * ```ts
   * type Provider = "ollama" | "openrouter";
   *
   * const pick = match<Provider>()
   *   .withEither("ollama", "openrouter", (p) => p) // p: "ollama" | "openrouter"
   *   .exhaustive();
   * pick("ollama"); // "ollama"
   * ```
   */
  withEither<const P1 extends Pattern<T>, const P2 extends Pattern<T>, R2>(
    pattern1: P1,
    pattern2: P2,
    handler: (input: NarrowUnion<T, readonly [P1, P2]>) => HandlerReturn<Locked, R, R2>,
  ): MatchBuilder<
    T,
    NextResult<Locked, R, R2>,
    HasInput,
    readonly [...Handled, NarrowUnion<T, readonly [P1, P2]>],
    Locked
  > {
    return this.withOneOf([pattern1, pattern2], handler);
  }

  /**
   * Lock the result type. All subsequent `.with()` handlers must return `R2`.
   * Useful when branch return-type inference widens to a union narrower than
   * the slot the match feeds into (e.g. `ReactNode`).
   *
   * Also the fix for literal-widening: when a handler returns an object whose
   * field is a union literal, inference widens it (e.g. `{ mode: "native" }`
   * becomes `{ mode: string }`, breaking a `Mode` union). Lock the target type
   * instead of sprinkling `as const`:
   *
   * @example
   * ```ts
   * type State = { mode: "compat" | "native" };
   * const next = match(flag)
   *   .returnType<State>()                       // handlers now checked against State
   *   .with("--native", () => ({ mode: "native" })) // no `as const` needed
   *   .otherwise(() => state);
   * ```
   */
  returnType<R2>(): MatchBuilder<T, R2, HasInput, Handled, true> {
    return new MatchBuilder<T, R2, HasInput, Handled, true>(this.cases, this.input, this._handled);
  }

  /**
   * Run the accumulated cases now, without a compile-time exhaustiveness check.
   * Uses the value passed to {@link match} (data-first), or the value passed to
   * `run` (curried). Throws `"Non-exhaustive match"` if no case matches at
   * runtime — prefer {@link exhaustive} when the input is a closed union, or
   * {@link otherwise} for an explicit fallback.
   *
   * @param input - the value to match when the builder was created curried
   * @returns the matched handler's result
   * @throws if no case matches the input
   *
   * @example
   * ```ts
   * type Event = { type: "error"; message: string } | { type: "done" };
   *
   * const msg = match({ type: "error", message: "x" } as Event)
   *   .with({ type: "error" }, (e) => e.message)
   *   .run({ type: "error", message: "net" }); // "net"
   * ```
   */
  run(...input: readonly [input: T] | readonly []): R {
    const value = input.length === 1 ? input[0] : this.input;
    if (value === NO_INPUT) {
      throw new Error("match.run: no input value");
    }
    const out = runCases(value, this.cases);
    if (out === NO_MATCH) {
      throw new Error("Non-exhaustive match: no case matched input");
    }
    return out as R;
  }

  /**
   * Settle the match with a compile-time exhaustiveness guarantee. Only
   * type-checks when every member of `T` has been handled; otherwise the return
   * type becomes {@link NonExhaustiveError}, surfacing the missing cases as a
   * type error. Returns the result directly when data-first ({@link match}
   * called with a value), or a reusable `(input: T) => R` matcher when curried.
   *
   * @returns the result (data-first) or a matcher function (curried)
   *
   * @example
   * ```ts
   * type Event =
   *   | { type: "message"; content: string }
   *   | { type: "error"; message: string }
   *   | { type: "done" };
   *
   * // Curried — reusable matcher; omitting a `.with` would be a type error.
   * const describe = match<Event>()
   *   .with({ type: "message" }, (e) => e.content)
   *   .with({ type: "error" },   (e) => `! ${e.message}`)
   *   .with({ type: "done" },    () => "done")
   *   .exhaustive();
   * describe({ type: "done" }); // "done"
   * ```
   */
  exhaustive(): ExhaustiveResult<T, Handled, R, HasInput> {
    // Safe: HasInput is true exactly when match(value) captured an input.
    return (
      this.input === NO_INPUT ? (value: T) => this.run(value) : this.run()
    ) as ExhaustiveResult<T, Handled, R, HasInput>;
  }

  /**
   * Settle the match with a catch-all fallback, dropping the exhaustiveness
   * requirement — `handler` runs (on the full input type) when no case matched.
   * Returns the result directly when data-first, or a reusable matcher when
   * curried.
   *
   * @param handler - fallback run on the input when no prior case matched
   * @returns the result (data-first) or a matcher function (curried)
   *
   * @example
   * ```ts
   * type Event =
   *   | { type: "message"; content: string }
   *   | { type: "error"; message: string }
   *   | { type: "done" };
   *
   * const len = match({ type: "done" } as Event)
   *   .with({ type: "message" }, (e) => e.content.length)
   *   .otherwise(() => -1); // -1
   * ```
   */
  otherwise(handler: (input: T) => R): HasInput extends true ? R : (input: T) => R {
    const runWithFallback = (value: T): R => {
      const out = runCases(value, this.cases);
      return out === NO_MATCH ? handler(value) : (out as R);
    };
    // Safe: HasInput is true exactly when match(value) captured an input.
    return (
      this.input === NO_INPUT ? runWithFallback : runWithFallback(this.input)
    ) as HasInput extends true ? R : (input: T) => R;
  }
}

/**
 * Result-locked variant of {@link MatchBuilder}. Constructed via
 * `match(...).returnType<R>()`. Now a thin type alias over `MatchBuilder`
 * with the `Locked` phantom flag set — kept for backwards compatibility.
 */
export type LockedMatchBuilder<
  T,
  R,
  HasInput extends boolean = false,
  Handled extends readonly unknown[] = [],
> = MatchBuilder<T, R, HasInput, Handled, true>;

/**
 * Start a pattern-matching expression. Two call shapes:
 *
 * - `match(value)` — data-first; subsequent `.exhaustive()` or
 *   `.otherwise(fn)` runs immediately against `value`.
 * - `match<T>()` — curried; subsequent `.exhaustive()` returns a function
 *   `(value: T) => R` for use in `pipe(...)` or as a reusable matcher.
 *
 * @example
 * ```ts
 * // Data-first
 * const out = match({ kind: "click", x: 1, y: 2 } as Event)
 *   .with({ kind: "click" }, (e) => e.x + e.y)
 *   .with({ kind: "key" },   () => -1)
 *   .exhaustive();
 *
 * // Curried — build a reusable matcher
 * const describe = match<Event>()
 *   .with({ kind: "click" }, (e) => `click @ ${e.x},${e.y}`)
 *   .with({ kind: "key" },   (e) => `key ${e.code}`)
 *   .exhaustive();
 * ```
 */
export function match<T>(input: T): MatchBuilder<T, never, true>;
export function match<T = never>(): MatchBuilder<T, never, false>;
export function match<T>(
  ...input: readonly [input: T] | readonly []
): MatchBuilder<T, never, boolean> {
  return input.length === 1
    ? new MatchBuilder<T, never, boolean>([], input[0])
    : new MatchBuilder<T, never, boolean>([], NO_INPUT);
}
