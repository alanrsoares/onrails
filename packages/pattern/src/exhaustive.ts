import type { GuardTarget } from "./narrow.js";

/**
 * Union members of `T` ruled out by pattern `P`.
 * Boolean guards (non-predicates) do not advance exhaustiveness — use `when(isX)` or `.otherwise()`.
 */
export type ExhaustMatched<T, P> = P extends (input: T) => boolean
  ? [GuardTarget<P>] extends [never]
    ? never
    : Extract<T, GuardTarget<P>>
  : Extract<T, P>;

/** Union of cases already handled by prior branches. */
export type HandledUnion<Handled extends readonly unknown[]> = Handled[number];

/** Input cases not yet covered by `.with` / `.withOneOf` / `.withEither`. */
export type RemainingCases<T, Handled extends readonly unknown[]> = Exclude<
  T,
  HandledUnion<Handled>
>;

/** `true` when every member of `T` appears in `Handled`, otherwise `false`. */
export type IsExhaustive<T, Handled extends readonly unknown[]> = [
  RemainingCases<T, Handled>,
] extends [never]
  ? true
  : false;

/** `.exhaustive()` shape: the value `R` when an input was given, else a `(input: T) => R` matcher. */
export type ExhaustiveOutput<R, HasInput extends boolean, T> = HasInput extends true
  ? R
  : (input: T) => R;

/** Returned by `.exhaustive()` when union cases are still missing (compile-time error). */
export type NonExhaustiveError<Remaining> = {
  readonly __nonExhaustive: "Add .with() branches for remaining cases";
  readonly remaining: Remaining;
};

/** `.exhaustive()` return type — `NonExhaustiveError` when cases are missing. */
export type ExhaustiveResult<T, Handled extends readonly unknown[], R, HasInput extends boolean> =
  IsExhaustive<T, Handled> extends true
    ? ExhaustiveOutput<R, HasInput, T>
    : NonExhaustiveError<RemainingCases<T, Handled>>;
