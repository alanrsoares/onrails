/**
 * The core railway type: a tagged union carrying either a success value
 * (`Ok<T>`) or a failure value (`Err<E>`). It is a plain discriminated union
 * on `_tag` — no classes — so it is immutable and tree-shake friendly. Narrow
 * with {@link isOk} / {@link isErr} to read `.value` / `.error`.
 *
 * @typeParam T - the `Ok` value type
 * @typeParam E - the `Err` error type
 *
 * @example
 * ```ts
 * function parse(raw: string): Result<number, "nan"> {
 *   const n = Number(raw);
 *   return Number.isNaN(n) ? err("nan") : ok(n);
 * }
 * ```
 */
export type Result<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };

/**
 * The success branch of a {@link Result} — `{ _tag: "Ok"; value: T }`.
 * The `E` parameter keeps the type assignable to `Result<T, E>`.
 */
export type Ok<T, E = never> = Extract<Result<T, E>, { _tag: "Ok" }>;

/**
 * The failure branch of a {@link Result} — `{ _tag: "Err"; error: E }`.
 */
export type Err<T, E> = Extract<Result<T, E>, { _tag: "Err" }>;

/**
 * Error subclass representing an **unexpected** defect — a thrown exception or
 * promise rejection that was not part of the modelled `Err` union. Used as the
 * default mapping when {@link fromAsync} is called without an `onDefect`
 * handler; the original cause is preserved on `.cause`.
 *
 * @example
 * ```ts
 * const defect = new UnexpectedError("Unexpected async defect", caught);
 * defect.cause; // the original thrown value
 * ```
 */
export class UnexpectedError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "UnexpectedError";
  }
}
