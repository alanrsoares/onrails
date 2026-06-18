import type { Pattern } from "./match.js";

/**
 * Guard pattern for {@link match}.with.
 *
 * Accepts plain boolean guards (`(x) => x.length > 0`) or TS type-predicate
 * guards (`(x): x is Foo => ...`). For type predicates, the matched handler's
 * input is narrowed to the predicate's target type via {@link Narrow}.
 *
 * Note: a plain boolean guard does not advance exhaustiveness tracking — pair
 * it with `.otherwise()`, or use a type predicate to narrow the union.
 *
 * @param guard - boolean or type-predicate guard function
 * @returns the guard, usable as a {@link Pattern} in `.with`
 *
 * @example
 * ```ts
 * const sign = match<number>()
 *   .with(when((n) => n < 0), () => "neg")
 *   .with(when((n) => n >= 0), () => "non-neg")
 *   .exhaustive();
 * sign(-1); // "neg"
 * sign(0);  // "non-neg"
 * ```
 */
export function when<T, U extends T>(guard: (input: T) => input is U): (input: T) => input is U;
export function when<T>(guard: (input: T) => boolean): Pattern<T>;
export function when<T>(guard: (input: T) => boolean): Pattern<T> {
  return guard;
}
