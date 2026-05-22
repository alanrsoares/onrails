import type { Pattern } from "./match.js";

/**
 * Guard pattern for {@link match}.with.
 *
 * Accepts plain boolean guards (`(x) => x.length > 0`) or TS type-predicate
 * guards (`(x): x is Foo => ...`). For type predicates, the matched handler's
 * input is narrowed to the predicate's target type via {@link Narrow}.
 */
export function when<T, U extends T>(guard: (input: T) => input is U): (input: T) => input is U;
export function when<T>(guard: (input: T) => boolean): Pattern<T>;
export function when<T>(guard: (input: T) => boolean): Pattern<T> {
  return guard;
}
