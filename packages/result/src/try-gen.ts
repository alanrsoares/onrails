import { err, isErr } from "./result.js";
import type { Result } from "./types.js";

/** Internal control-flow signal — not part of public error types */
class ErrSignal<E> {
  readonly _tag = "ErrSignal" as const;
  constructor(readonly error: E) {}
}

/**
 * Unwraps a {@link Result} inside a {@link tryGen} block — the sync analogue of
 * Rust's `?` operator. On `Ok` it returns the value; on `Err` it short-circuits
 * the enclosing `tryGen`, which returns that `Err`. Only valid inside `tryGen`;
 * prefer {@link flatMap} / `pipe` for long pipelines.
 *
 * @returns the unwrapped `Ok` value
 *
 * @example
 * ```ts
 * const out = tryGen(() => {
 *   const a = yieldResult(parseA());   // unwrap or short-circuit
 *   const b = yieldResult(parseB());
 *   return ok(a + b);
 * });
 * ```
 */
export const yieldResult = <T, E>(result: Result<T, E>): T => {
  if (isErr(result)) {
    throw new ErrSignal(result.error);
  }
  return result.value;
};

/**
 * Terse alias of {@link yieldResult} (mirrors Rust's `?`), for compact
 * {@link tryGen} blocks.
 *
 * @example
 * ```ts
 * const out = tryGen(() => {
 *   const a = $(parseA());
 *   const b = $(parseB());
 *   return ok(a + b);
 * });
 * ```
 */
export const $ = yieldResult;

/**
 * Run a block that uses {@link yieldResult}; returns the final `Result` or the first Err.
 *
 * @example
 * ```ts
 * const out = tryGen(() => {
 *   const a = $(parseA());
 *   const b = $(parseB());
 *   return ok(a + b);
 * });
 * ```
 */
export const tryGen = <T, E>(fn: () => Result<T, E>): Result<T, E> => {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ErrSignal) {
      return err(error.error);
    }
    throw error;
  }
};
