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
 * type Event = { kind: "click"; x: number } | { kind: "key"; code: string };
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
  constructor(
    private readonly cases: readonly Case<T, unknown>[] = [],
    private readonly input?: T,
    // Safe: phantom tuple — only used for compile-time exhaustiveness tracking.
    readonly _handled: Handled = [] as unknown as Handled,
  ) {}

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
    const next: Case<T, unknown> = {
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => unknown,
    };
    return new MatchBuilder([...this.cases, next], this.input, [
      ...this._handled,
    ] as unknown as readonly [...Handled, ExhaustMatched<T, P>]);
  }

  /** One handler for several patterns (OR). Handler input is the union of narrowed members. */
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
    const next = caseForPatterns(patterns, handler as (input: T) => unknown);
    return new MatchBuilder([...this.cases, next], this.input, [
      ...this._handled,
    ] as unknown as readonly [...Handled, NarrowUnion<T, Ps>]);
  }

  /** `withOneOf` for exactly two patterns. */
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

  /** Run on the value passed to {@link match}, or on `input` when curried. */
  run(input?: T): R {
    const value = input ?? this.input;
    if (value === undefined) {
      throw new Error("match.run: no input value");
    }
    const out = runCases(value, this.cases);
    if (out === NO_MATCH) {
      throw new Error("Non-exhaustive match: no case matched input");
    }
    return out as R;
  }

  exhaustive(): ExhaustiveResult<T, Handled, R, HasInput> {
    if (this.input !== undefined) {
      return this.run() as ExhaustiveResult<T, Handled, R, HasInput>;
    }
    return ((value: T) => this.run(value)) as ExhaustiveResult<T, Handled, R, HasInput>;
  }

  otherwise(handler: (input: T) => R): HasInput extends true ? R : (input: T) => R {
    const runWithFallback = (value: T): R => {
      const out = runCases(value, this.cases);
      return out === NO_MATCH ? handler(value) : (out as R);
    };
    if (this.input !== undefined) {
      return runWithFallback(this.input) as HasInput extends true ? R : (input: T) => R;
    }
    return runWithFallback as HasInput extends true ? R : (input: T) => R;
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
export function match<T>(input?: T): MatchBuilder<T, never, boolean> {
  return new MatchBuilder([], input);
}
