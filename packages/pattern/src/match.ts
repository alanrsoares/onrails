import type { Narrow } from "./narrow.js";

export type Pattern<T> = T | PatternObject | PatternGuard<T>;

type PatternObject = Record<string, unknown>;

type PatternGuard<T> = (input: T) => boolean;

type Case<T, R> = {
  readonly test: (input: T) => boolean;
  readonly run: (input: T) => R;
};

const isGuard = <T>(pattern: Pattern<T>): pattern is PatternGuard<T> =>
  typeof pattern === "function";

const isPatternObject = (pattern: unknown): pattern is PatternObject =>
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
  for (const key of Object.keys(pattern)) {
    if (record[key] !== pattern[key]) {
      return false;
    }
  }
  return true;
};

const runCases = <T, R>(input: T, cases: readonly Case<T, R>[]): R | undefined => {
  for (const c of cases) {
    if (c.test(input)) {
      return c.run(input);
    }
  }
  return undefined;
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

  /** Run on the value passed to {@link match}, or on `input` when curried. */
  run(input?: T): R {
    const value = input ?? this.input;
    if (value === undefined) {
      throw new Error("match.run: no input value");
    }
    const out = runCases(value, this.cases);
    if (out === undefined) {
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
      return out === undefined ? handler(value) : (out as R);
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
