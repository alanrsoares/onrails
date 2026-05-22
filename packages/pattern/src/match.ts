import type { ExhaustiveResult, ExhaustMatched } from "./exhaustive.js";
import type { Narrow, NarrowUnion } from "./narrow.js";

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

export class MatchBuilder<
  T,
  R = never,
  HasInput extends boolean = false,
  Handled extends readonly unknown[] = [],
> {
  constructor(
    private readonly cases: readonly Case<T, unknown>[] = [],
    private readonly input?: T,
    // Safe: phantom tuple — only used for compile-time exhaustiveness tracking.
    readonly _handled: Handled = [] as unknown as Handled,
  ) {}

  with<const P extends Pattern<T>, R2>(
    pattern: P,
    handler: (input: Narrow<T, P>) => R2,
  ): MatchBuilder<T, R | R2, HasInput, readonly [...Handled, ExhaustMatched<T, P>]> {
    const next: Case<T, R | R2> = {
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => R | R2,
    };
    return new MatchBuilder<T, R | R2, HasInput, readonly [...Handled, ExhaustMatched<T, P>]>(
      [...this.cases, next],
      this.input,
      [...this._handled] as unknown as readonly [...Handled, ExhaustMatched<T, P>],
    );
  }

  /** One handler for several patterns (OR). Handler input is the union of narrowed members. */
  withOneOf<const Ps extends readonly Pattern<T>[], R2>(
    patterns: Ps,
    handler: (input: NarrowUnion<T, Ps>) => R2,
  ): MatchBuilder<T, R | R2, HasInput, readonly [...Handled, NarrowUnion<T, Ps>]> {
    const next = caseForPatterns(patterns, handler as (input: T) => R | R2);
    return new MatchBuilder<T, R | R2, HasInput, readonly [...Handled, NarrowUnion<T, Ps>]>(
      [...this.cases, next],
      this.input,
      [...this._handled] as unknown as readonly [...Handled, NarrowUnion<T, Ps>],
    );
  }

  /** `withOneOf` for exactly two patterns. */
  withEither<const P1 extends Pattern<T>, const P2 extends Pattern<T>, R2>(
    pattern1: P1,
    pattern2: P2,
    handler: (input: NarrowUnion<T, readonly [P1, P2]>) => R2,
  ): MatchBuilder<T, R | R2, HasInput, readonly [...Handled, NarrowUnion<T, readonly [P1, P2]>]> {
    return this.withOneOf([pattern1, pattern2], handler);
  }

  /**
   * Lock the result type. All subsequent `.with()` handlers must return `R2`.
   * Useful when branch return-type inference widens to a union narrower than
   * the slot the match feeds into (e.g. `ReactNode`).
   */
  returnType<R2>(): LockedMatchBuilder<T, R2, HasInput, Handled> {
    return new LockedMatchBuilder<T, R2, HasInput, Handled>(this.cases, this.input, this._handled);
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
 * `match(...).returnType<R>()`. All `.with()` handlers are constrained to
 * return `R`; the accumulator never widens.
 */
export class LockedMatchBuilder<
  T,
  R,
  HasInput extends boolean = false,
  Handled extends readonly unknown[] = [],
> {
  constructor(
    private readonly cases: readonly Case<T, unknown>[] = [],
    private readonly input?: T,
    readonly _handled: Handled = [] as unknown as Handled,
  ) {}

  with<const P extends Pattern<T>>(
    pattern: P,
    handler: (input: Narrow<T, P>) => R,
  ): LockedMatchBuilder<T, R, HasInput, readonly [...Handled, ExhaustMatched<T, P>]> {
    const next: Case<T, R> = {
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => R,
    };
    return new LockedMatchBuilder<T, R, HasInput, readonly [...Handled, ExhaustMatched<T, P>]>(
      [...this.cases, next],
      this.input,
      [...this._handled] as unknown as readonly [...Handled, ExhaustMatched<T, P>],
    );
  }

  withOneOf<const Ps extends readonly Pattern<T>[]>(
    patterns: Ps,
    handler: (input: NarrowUnion<T, Ps>) => R,
  ): LockedMatchBuilder<T, R, HasInput, readonly [...Handled, NarrowUnion<T, Ps>]> {
    const next = caseForPatterns(patterns, handler as (input: T) => R);
    return new LockedMatchBuilder<T, R, HasInput, readonly [...Handled, NarrowUnion<T, Ps>]>(
      [...this.cases, next],
      this.input,
      [...this._handled] as unknown as readonly [...Handled, NarrowUnion<T, Ps>],
    );
  }

  withEither<const P1 extends Pattern<T>, const P2 extends Pattern<T>>(
    pattern1: P1,
    pattern2: P2,
    handler: (input: NarrowUnion<T, readonly [P1, P2]>) => R,
  ): LockedMatchBuilder<T, R, HasInput, readonly [...Handled, NarrowUnion<T, readonly [P1, P2]>]> {
    return this.withOneOf([pattern1, pattern2], handler);
  }

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

export function match<T>(input: T): MatchBuilder<T, never, true>;
export function match<T = never>(): MatchBuilder<T, never, false>;
export function match<T>(input?: T): MatchBuilder<T, never, boolean> {
  return new MatchBuilder([], input);
}
