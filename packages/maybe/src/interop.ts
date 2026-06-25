import { err, isOk, ok, type Result } from "@onrails/result";
import { fromNullable, isSome, type Maybe, none, some } from "./maybe.js";

/** Sentinel error tag — `Maybe<T>` bridges to `Result<T, NoneError>`. */
export type NoneError = { readonly _tag: "None" };

/** Construct the {@link NoneError} sentinel. */
export const noneError = (): NoneError => ({ _tag: "None" });

/** Lift absence into a domain error. */
export function toResult<T, E>(maybe: Maybe<T>, onNone: () => E): Result<T, E>;
export function toResult<E>(onNone: () => E): <T>(maybe: Maybe<T>) => Result<T, E>;
export function toResult(...args: [Maybe<unknown>, () => unknown] | [() => unknown]): unknown {
  if (args.length === 2) {
    const [maybe, onNone] = args;
    return isSome(maybe) ? ok(maybe.value) : err(onNone());
  }
  const onNone = args[0];
  return (maybe: Maybe<unknown>) => (isSome(maybe) ? ok(maybe.value) : err(onNone()));
}

/** Ok values become Some; any Err becomes None (errors are not absence). */
export function fromResult<T, E>(result: Result<T, E>): Maybe<T>;
export function fromResult<T, E>(): (result: Result<T, E>) => Maybe<T>;
export function fromResult(...args: [Result<unknown, unknown>] | []): unknown {
  if (args.length === 1) {
    const result = args[0];
    return isOk(result) ? some(result.value) : none();
  }
  return (result: Result<unknown, unknown>) => (isOk(result) ? some(result.value) : none());
}

/** Nullable edge → Maybe; explicit None error at the boundary. */
export function nullableToResult<T, E>(value: T | null | undefined, onNone: () => E): Result<T, E>;
export function nullableToResult<E>(
  onNone: () => E,
): <T>(value: T | null | undefined) => Result<T, E>;
export function nullableToResult(...args: [unknown, () => unknown] | [() => unknown]): unknown {
  if (args.length === 2) {
    const [value, onNone] = args;
    return toResult(fromNullable(value), onNone);
  }
  const onNone = args[0];
  return (value: unknown) => toResult(fromNullable(value), onNone);
}

/** True when a Result failed specifically with {@link NoneError}. */
export const isNoneError = (result: Result<unknown, unknown>): result is Result<never, NoneError> =>
  !isOk(result) && isNoneErrorValue(result.error);

const isNoneErrorValue = (error: unknown): error is NoneError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  (error as { _tag: unknown })._tag === "None";
