import { mkErr, mkOk } from "./internal/ctor.js";

/**
 * Plain-data shape of a {@link Result}: what `JSON.parse`, `structuredClone`
 * and `postMessage` hand back. It has no methods; lift it with `Result.from`.
 */
export type ResultData<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };

/**
 * Methods every live {@link Result} carries on its (non-enumerable) prototype.
 * Core semantics: `tap` does not swallow throws, `recover` keeps the `Ok` type.
 * Method syntax keeps the type parameters bivariant, so `Result<T, never>` is
 * assignable to `Result<T, E>`.
 */
export interface ResultMethods<T, E> {
  /** Transform the `Ok` value; `Err` passes through. */
  map<U>(fn: (value: T) => U): Result<U, E>;
  /** Transform the `Err` value; `Ok` passes through. */
  mapErr<F>(fn: (error: E) => F): Result<T, F>;
  /** Canonical bind; widens the error union and short-circuits on `Err`. */
  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
  /** Alias of {@link ResultMethods.flatMap} for neverthrow muscle memory. */
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
  /** Error-track bind; recover to `Ok` or remap the failure. */
  recover<F>(fn: (error: E) => Result<T, F>): Result<T, F>;
  /** Observe the `Ok` value, pass the result through. */
  tap(fn: (value: T) => void): Result<T, E>;
  /** Observe the `Err` value, pass the result through. */
  tapErr(fn: (error: E) => void): Result<T, E>;
  /** Fold both tracks into one value. */
  match<U>(onOk: (value: T) => U, onErr: (error: E) => U): U;
  /** The `Ok` value, or `defaultValue` on `Err`. */
  unwrapOr<U>(defaultValue: U): T | U;
}

/**
 * The core railway type: a tagged union carrying either a success value
 * (`Ok<T>`) or a failure value (`Err<E>`), discriminated on `_tag`. Carriers
 * are plain data (`_tag` plus `value` / `error` as own enumerable properties)
 * with {@link ResultMethods} on a shared non-enumerable prototype, so
 * `JSON.stringify` output is unchanged. Narrow on `_tag` to read
 * `.value` / `.error`.
 *
 * Build carriers with `ok` / `err`; a hand-written `{ _tag: "Ok", value }`
 * literal has no methods and is not a `Result`. Data that crossed a
 * serialization boundary is lifted back with `Result.from`.
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
 * parse("1").map((n) => n + 1);
 * ```
 */
export type Result<T, E> = ResultData<T, E> & ResultMethods<T, E>;

/**
 * Value-side companion of the {@link Result} type.
 *
 * `from` lifts plain data back into a live `Result`. Use it at every
 * deserialization sink (`JSON.parse`, `structuredClone`, `postMessage`,
 * IndexedDB, Redux rehydration), where the prototype and its methods are lost
 * while the type still claims them. It trusts the shape; validate untrusted
 * input first. An unknown `_tag` is a defect and throws a `TypeError` rather
 * than becoming a silent `Err(undefined)`.
 *
 * @example
 * ```ts
 * const wire = JSON.parse(JSON.stringify(ok(1)));   // plain data, no methods
 * const live = Result.from<number, string>(wire);   // Result<number, string>
 * live.map((n) => n + 1);
 * ```
 */
export const Result = {
  from: <T, E>(data: ResultData<T, E>): Result<T, E> => {
    if (data._tag === "Ok") return mkOk<T, E>(data.value);
    if (data._tag === "Err") return mkErr<T, E>(data.error);
    throw new TypeError(`Result.from: unknown _tag ${String((data as { _tag?: unknown })._tag)}`);
  },
} as const;

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
