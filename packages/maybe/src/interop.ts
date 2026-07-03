import { err, isOk, ok, type Result } from "@onrails/result";
import { dual } from "./internal/dual.js";
import { fromNullable, isSome, type Maybe, none, some } from "./maybe.js";

/** Sentinel error tag — `Maybe<T>` bridges to `Result<T, NoneError>`. */
export type NoneError = { readonly _tag: "None" };

/** Construct the {@link NoneError} sentinel. */
export const noneError = (): NoneError => ({ _tag: "None" });

const toResultImpl = <T, E>(maybe: Maybe<T>, onNone: () => E): Result<T, E> =>
  isSome(maybe) ? ok(maybe.value) : err(onNone());

/** Lift absence into a domain error. */
export const toResult: {
  <T, E>(maybe: Maybe<T>, onNone: () => E): Result<T, E>;
  <E>(onNone: () => E): <T>(maybe: Maybe<T>) => Result<T, E>;
} = dual(2, toResultImpl);

const fromResultImpl = <T, E>(result: Result<T, E>): Maybe<T> =>
  isOk(result) ? some(result.value) : none();

/** Ok values become Some; any Err becomes None (errors are not absence). */
export const fromResult: {
  <T, E>(result: Result<T, E>): Maybe<T>;
  <T, E>(): (result: Result<T, E>) => Maybe<T>;
} = dual(1, fromResultImpl);

const nullableToResultImpl = <T, E>(value: T | null | undefined, onNone: () => E): Result<T, E> =>
  toResultImpl(fromNullable(value), onNone);

/** Nullable edge → Maybe; explicit None error at the boundary. */
export const nullableToResult: {
  <T, E>(value: T | null | undefined, onNone: () => E): Result<T, E>;
  <E>(onNone: () => E): <T>(value: T | null | undefined) => Result<T, E>;
} = dual(2, nullableToResultImpl);

/** True when a Result failed specifically with {@link NoneError}. */
export const isNoneError = (result: Result<unknown, unknown>): result is Result<never, NoneError> =>
  !isOk(result) && isNoneErrorValue(result.error);

const isNoneErrorValue = (error: unknown): error is NoneError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  (error as { _tag: unknown })._tag === "None";
