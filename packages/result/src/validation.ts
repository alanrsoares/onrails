import { err, isErr, ok } from "./result.js";
import type { Result } from "./types.js";

type OkValue<R> = R extends { readonly _tag: "Ok"; readonly value: infer T } ? T : never;
type ErrValue<R> = R extends { readonly _tag: "Err"; readonly error: infer E } ? E : never;

type ValidateTuple<R extends readonly Result<unknown, unknown>[], E> = Result<
  { [K in keyof R]: OkValue<R[K]> },
  E
>;
type TupleErrors<R extends readonly Result<unknown, unknown>[]> = ErrValue<R[number]>;

/**
 * Accumulate independent validation failures into a single combined error
 * via `combineErrors`. Returns `Ok<T[]>` only when every input is `Ok`;
 * otherwise returns `Err<E>` where `E` is the fold of all failures.
 *
 * Unlike `combine`, this does **not** short-circuit on first failure — use
 * for independent checks where you want to report all problems at once.
 *
 * @example
 * ```ts
 * validateAll(
 *   [validateName(input), validateAge(input), validateEmail(input)],
 *   (left, right) => [...left, ...right],
 * );
 * // Result<string[], FieldError[]>
 * ```
 */
export const validateAll = <T, E>(
  results: readonly Result<T, E>[],
  combineErrors: (left: E, right: E) => E,
): Result<T[], E> => {
  const values: T[] = [];
  let accumulated: E | undefined;

  for (const result of results) {
    if (isErr(result)) {
      accumulated =
        accumulated === undefined ? result.error : combineErrors(accumulated, result.error);
    } else {
      values.push(result.value);
    }
  }

  return accumulated === undefined ? ok(values) : err(accumulated);
};

/**
 * Tuple-preserving variant of {@link validateAll}. All inputs must share
 * the same error type `E`. Output Ok preserves tuple positions.
 *
 * @example
 * ```ts
 * validateTuple(
 *   [validateName(s), validateAge(s)] as const,
 *   (l, r) => [...l, ...r],
 * );
 * // Result<readonly [string, number], FieldError[]>
 * ```
 */
export const validateTuple = <E, const R extends readonly Result<unknown, E>[]>(
  results: R,
  combineErrors: (left: E, right: E) => E,
): ValidateTuple<R, E> => {
  const values: unknown[] = [];
  let accumulated: E | undefined;

  for (const result of results) {
    if (isErr(result)) {
      const error = result.error;
      accumulated = accumulated === undefined ? error : combineErrors(accumulated, error);
    } else {
      values.push(result.value);
    }
  }

  return (accumulated === undefined ? ok(values) : err(accumulated)) as ValidateTuple<R, E>;
};

/**
 * Like {@link validateAll}, but collects every failure into a readonly
 * array instead of folding via a combine function. The default choice
 * when you want "all errors" without an explicit join.
 *
 * @example
 * ```ts
 * validateAllArray([validateName(input), validateAge(input)]);
 * // Result<readonly Field[], readonly FieldError[]>
 * ```
 */
export const validateAllArray = <T, E>(
  results: readonly Result<T, E>[],
): Result<T[], readonly E[]> => {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (isErr(result)) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  return errors.length === 0 ? ok(values) : err(errors);
};

/**
 * Tuple-preserving variant of {@link validateAllArray}. Heterogeneous
 * input tuple → preserved Ok tuple shape with a union of all input
 * error types collected into a readonly array.
 *
 * @example
 * ```ts
 * validateTupleArray([validateName(s), validateAge(s)] as const);
 * // Result<readonly [string, number], readonly FieldError[]>
 * ```
 */
export const validateTupleArray = <const R extends readonly Result<unknown, unknown>[]>(
  results: R,
): ValidateTuple<R, readonly TupleErrors<R>[]> => {
  const values: unknown[] = [];
  const errors: TupleErrors<R>[] = [];

  for (const result of results) {
    if (isErr(result)) {
      errors.push(result.error as TupleErrors<R>);
    } else {
      values.push(result.value);
    }
  }

  return (errors.length === 0 ? ok(values) : err(errors)) as ValidateTuple<
    R,
    readonly TupleErrors<R>[]
  >;
};
