/**
 * @onrails/result — sync aggregation, one module, two axes:
 *
 *   short-circuit (first `Err` wins)      — {@link combine} / {@link combineTuple}
 *   accumulate expected failures          — {@link validateAll} / {@link validateTuple}
 *
 * The accumulate pair collects every failure into a readonly array by
 * default, or folds them with an explicit `combineErrors` when given one.
 */

import type { InferErr, InferOk } from "./internal/infer.js";
import { err, isErr, ok } from "./result.js";
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
    if (isErr(result)) return err(result.error);
    values.push(result.value);
  }
  return ok(values);
};

type CombineTuple<R extends readonly Result<unknown, unknown>[]> = Result<
  { [K in keyof R]: InferOk<R[K]> },
  { [K in keyof R]: InferErr<R[K]> }[number]
>;

/**
 * Heterogeneous tuple combine — like {@link combine} but preserves each
 * branch's `Ok` type by position, so the result destructures type-safely.
 * Short-circuits on the first `Err` in input order (neverthrow-style).
 *
 * @example
 * ```ts
 * const r = combineTuple([ok(1), ok("x")] as const);
 * // Result<readonly [number, string], never>
 * if (isOk(r)) {
 *   const [n, s] = r.value;   // typed per position
 * }
 * ```
 */
export const combineTuple = <const R extends readonly Result<unknown, unknown>[]>(
  results: R,
): CombineTuple<R> =>
  // Runtime identical to combine; the cast restores per-index tuple types.
  combine(results as readonly Result<unknown, unknown>[]) as CombineTuple<R>;

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

  if (errors.length === 0) return ok(values);
  return err(combineErrors ? errors.reduce(combineErrors) : errors);
}

/**
 * Tuple-preserving variant of {@link validateAll}. Heterogeneous input tuple
 * → preserved `Ok` tuple shape. Without a combiner, the error union is
 * collected into a readonly array; with `combineErrors`, all inputs must
 * share the error type `E` and failures fold into a single `E`.
 *
 * @example
 * ```ts
 * const name: Result<string, string[]> = ok("Ada");
 * const age: Result<number, string[]> = ok(36);
 *
 * validateTuple([name, age] as const);
 * // Result<readonly [string, number], readonly string[][]>
 *
 * validateTuple([name, age] as const, (l, r) => [...l, ...r]);
 * // Result<readonly [string, number], string[]>
 * ```
 */
export function validateTuple<const R extends readonly Result<unknown, unknown>[]>(
  results: R,
): Result<{ [K in keyof R]: InferOk<R[K]> }, readonly InferErr<R[number]>[]>;
export function validateTuple<
  const R extends readonly Result<unknown, unknown>[],
  E = InferErr<R[number]>,
>(
  results: R & readonly Result<unknown, E>[],
  combineErrors: (left: E, right: E) => E,
): Result<{ [K in keyof R]: InferOk<R[K]> }, E>;
export function validateTuple(
  results: readonly Result<unknown, unknown>[],
  combineErrors?: (left: unknown, right: unknown) => unknown,
): Result<readonly unknown[], unknown> {
  // Runtime identical to validateAll; the overloads restore per-index tuple types.
  return combineErrors ? validateAll(results, combineErrors) : validateAll(results);
}
