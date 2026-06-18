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

type _OkValue<R> = R extends { _tag: "Ok"; readonly value: infer T } ? T : never;
type _ErrValue<R> = R extends { _tag: "Err"; readonly error: infer E } ? E : never;

type CombineTuple<R extends readonly Result<unknown, unknown>[]> = Result<
  { [K in keyof R]: _OkValue<R[K]> },
  { [K in keyof R]: _ErrValue<R[K]> }[number]
>;
