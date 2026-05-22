import { err, isErr } from "./result.js";
import type { Result } from "./types.js";

/** Internal control-flow signal — not part of public error types */
class ErrSignal<E> {
  readonly _tag = "ErrSignal" as const;
  constructor(readonly error: E) {}
}

/**
 * Unwrap a {@link Result} inside {@link tryGen} (Rust `?` for sync code).
 * Prefer {@link flatMap} / {@link fluent} for long pipelines.
 */
export const yieldResult = <T, E>(result: Result<T, E>): T => {
  if (isErr(result)) {
    throw new ErrSignal(result.error);
  }
  return result.value;
};

/**
 * Run a block that uses {@link yieldResult}; returns the final `Result` or the first Err.
 *
 * @example
 * ```ts
 * const out = tryGen(() => {
 *   const a = yieldResult(parseA());
 *   const b = yieldResult(parseB());
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
