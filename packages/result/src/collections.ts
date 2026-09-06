/**
 * @onrails/result — sync aggregation, one module, two axes:
 *
 *   short-circuit (first `Err` wins)      — {@link combine} / {@link combineTuple}
 *   accumulate expected failures          — {@link validateAll} / {@link validateTuple}
 *
 * The accumulate pair collects every failure into a readonly array by
 * default, or folds them with an explicit `combineErrors` when given one.
 */

import { mkErr, mkOk } from "./internal/ctor.js";
import type { InferErr, InferOk } from "./internal/infer.js";
import { isErr } from "./result.js";
import type { Result } from "./types.js";

/**
 * Combines a homogeneous array of results into a single result holding an
 * array of the `Ok` values, in input order. Short-circuits on the first `Err`
 * (first failure wins). For heterogeneous tuples that preserve per-index
 * types, use {@link combineTuple}.
 *
 * @example
 * ```ts
 * combine([ok(1), ok(2)]);        // Ok([1, 2])
 * combine([ok(1), err("e")]);     // Err("e")
 * ```
 */
export const combine = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) return mkErr(result.error);
    values.push(result.value);
  }
  return mkOk(values);
};

type AnyResult = Result<unknown, unknown>;

/** Positionally preserved `Ok` payloads for a tuple of results. */
type OkTuple<R extends readonly unknown[]> = { [K in keyof R]: InferOk<R[K]> };

/**
 * The element check lives in the RETURN type, never in the parameter
 * constraint. A `readonly Result<unknown, unknown>[]` constraint contextually
 * types the arguments, which widens `ok(1)`'s defaulted `E = never` — and
 * `err(e)`'s `T = never` — all the way to `unknown`. Holding the parameter at
 * a bare `R` keeps both channels precise for inline literals, so call sites
 * need neither `as const` nor hoisted intermediates.
 */
type CombineTuple<R extends readonly unknown[]> = R[number] extends AnyResult
  ? Result<OkTuple<R>, InferErr<R[number]>>
  : never;

/**
 * Restores the "every element is a Result" check the parameter constraint used
 * to provide. Resolves to `[]` for a well-formed tuple and to a one-element
 * tuple otherwise, so a bad call fails at the call site (with the message
 * visible in signature help) instead of silently yielding `never`.
 */
type TupleGuard<R extends readonly unknown[]> = R[number] extends AnyResult
  ? []
  : [error: "expected an array of Result values"];

/**
 * Heterogeneous tuple combine — like {@link combine} but preserves each
 * branch's `Ok` type by position, so the result destructures type-safely.
 * Short-circuits on the first `Err` in input order (neverthrow-style).
 *
 * @example
 * ```ts
 * const r = combineTuple([ok(1), ok("x")]);
 * // Result<readonly [number, string], never> — no `as const` needed
 * if (isOk(r)) {
 *   const [n, s] = r.value;   // typed per position
 * }
 * ```
 */
export const combineTuple = <const R extends readonly unknown[]>(
  results: R,
  ..._guard: TupleGuard<R>
): CombineTuple<R> =>
  // Runtime identical to combine; the cast restores per-index tuple types.
  combine(results as readonly AnyResult[]) as CombineTuple<R>;

/**
 * Accumulate independent validation failures. Returns `Ok<T[]>` only when
 * every input is `Ok`. Without a combiner, failures are collected into a
 * readonly array; with `combineErrors` they are folded into a single `E`.
 *
 * Unlike {@link combine}, this does **not** short-circuit on first failure —
 * use for independent checks where you want to report all problems at once.
 *
 * @example
 * ```ts
 * const checks: Result<string, string[]>[] = [ok("Ada"), err(["age required"])];
 *
 * validateAll(checks);
 * // Result<string[], readonly string[][]>
 *
 * validateAll(checks, (left, right) => [...left, ...right]);
 * // Result<string[], string[]>
 * ```
 */
export function validateAll<T, E>(results: readonly Result<T, E>[]): Result<T[], readonly E[]>;
export function validateAll<T, E>(
  results: readonly Result<T, E>[],
  combineErrors: (left: E, right: E) => E,
): Result<T[], E>;
export function validateAll<T, E>(
  results: readonly Result<T, E>[],
  combineErrors?: (left: E, right: E) => E,
): Result<T[], E | readonly E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (isErr(result)) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  if (errors.length === 0) return mkOk(values);
  return mkErr(combineErrors ? errors.reduce(combineErrors) : errors);
}

/**
 * Tuple-preserving variant of {@link validateAll}. Heterogeneous input tuple
 * → preserved `Ok` tuple shape. Without a combiner, the error union is
 * collected into a readonly array; with `combineErrors`, all inputs must
 * share the error type `E` and failures fold into a single `E`.
 *
 * Like {@link combineTuple}, the element check lives in the return type, so
 * inline literals keep their precise error types without `as const`.
 *
 * @example
 * ```ts
 * const name: Result<string, string[]> = ok("Ada");
 * const age: Result<number, string[]> = ok(36);
 *
 * validateTuple([name, age]);
 * // Result<readonly [string, number], readonly string[][]>
 *
 * validateTuple([name, age], (l, r) => [...l, ...r]);
 * // Result<readonly [string, number], string[]>
 * ```
 */
export function validateTuple<const R extends readonly unknown[]>(
  results: R,
  ..._guard: TupleGuard<R>
): R[number] extends AnyResult ? Result<OkTuple<R>, readonly InferErr<R[number]>[]> : never;
export function validateTuple<const R extends readonly unknown[], E = InferErr<R[number]>>(
  results: R,
  combineErrors: (left: E, right: E) => E,
  ..._guard: TupleGuard<R>
): R[number] extends AnyResult ? Result<OkTuple<R>, E> : never;
export function validateTuple(
  results: readonly AnyResult[],
  // Rest-typed so both overloads (whose trailing `TupleGuard` arity differs)
  // stay assignable to this implementation signature.
  ...rest: readonly unknown[]
): Result<readonly unknown[], unknown> {
  const combineErrors = rest[0] as ((left: unknown, right: unknown) => unknown) | undefined;
  // Runtime identical to validateAll; the overloads restore per-index tuple types.
  return combineErrors ? validateAll(results, combineErrors) : validateAll(results);
}
