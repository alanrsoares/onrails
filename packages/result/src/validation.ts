import { err, isErr, ok } from "./result.js";
import type { Result } from "./types.js";

type OkValue<R> = R extends { readonly _tag: "Ok"; readonly value: infer T } ? T : never;
type ErrValue<R> = R extends { readonly _tag: "Err"; readonly error: infer E } ? E : never;

type ValidateTuple<R extends readonly Result<unknown, unknown>[], E> = Result<
  { [K in keyof R]: OkValue<R[K]> },
  E
>;
type TupleErrors<R extends readonly Result<unknown, unknown>[]> = ErrValue<R[number]>;

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
