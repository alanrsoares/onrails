import type { Narrow } from "./narrow.js";

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

export class MatchBuilder<T, R = never, HasInput extends boolean = false> {
  constructor(
    private readonly cases: readonly Case<T, unknown>[] = [],
    private readonly input?: T,
  ) {}

  with<const P extends Pattern<T>, R2>(
    pattern: P,
    handler: (input: Narrow<T, P>) => R2,
  ): MatchBuilder<T, R | R2, HasInput> {
    const next: Case<T, R | R2> = {
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => R | R2,
    };
    return new MatchBuilder([...this.cases, next], this.input);
  }

  /**
   * Lock the result type. All subsequent `.with()` handlers must return `R2`.
   * Useful when branch return-type inference widens to a union narrower than
   * the slot the match feeds into (e.g. `ReactNode`).
   */
  returnType<R2>(): LockedMatchBuilder<T, R2, HasInput> {
    return new LockedMatchBuilder<T, R2, HasInput>(this.cases, this.input);
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

  exhaustive(): HasInput extends true ? R : (input: T) => R {
    if (this.input !== undefined) {
      return this.run() as HasInput extends true ? R : (input: T) => R;
    }
    return ((value: T) => this.run(value)) as HasInput extends true ? R : (input: T) => R;
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
export class LockedMatchBuilder<T, R, HasInput extends boolean = false> {
  constructor(
    private readonly cases: readonly Case<T, unknown>[] = [],
    private readonly input?: T,
  ) {}

  with<const P extends Pattern<T>>(
    pattern: P,
    handler: (input: Narrow<T, P>) => R,
  ): LockedMatchBuilder<T, R, HasInput> {
    const next: Case<T, R> = {
      test: (input) => matches(input, pattern),
      run: handler as (input: T) => R,
    };
    return new LockedMatchBuilder([...this.cases, next], this.input);
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

  exhaustive(): HasInput extends true ? R : (input: T) => R {
    if (this.input !== undefined) {
      return this.run() as HasInput extends true ? R : (input: T) => R;
    }
    return ((value: T) => this.run(value)) as HasInput extends true ? R : (input: T) => R;
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
