import type { Result } from "./types.js";

/** Left-to-right composition for plain functions */
export const flow =
  <A, B>(ab: (a: A) => B) =>
  <C>(bc: (b: B) => C): ((a: A) => C) =>
  (a) =>
    bc(ab(a));

/** Pipe a value through a {@link Result}-returning step (value-first — best inference) */
export const pipeResult = <A, B, E>(value: A, fn: (a: A) => Result<B, E>): Result<B, E> =>
  fn(value);
