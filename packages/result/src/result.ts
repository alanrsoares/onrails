import type { Err, Ok, Result } from "./types.js";

export type { Err, Ok, Result } from "./types.js";

export const ok = <T, E = never>(value: T): Result<T, E> => ({
  _tag: "Ok",
  value,
});

export const err = <T = never, E = unknown>(error: E): Result<T, E> => ({
  _tag: "Err",
  error,
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result._tag === "Ok";

export const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => result._tag === "Err";

/** Fantasy Land `of` */
export const of = ok;

export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
  if (isOk(result)) {
    return ok<U, E>(fn(result.value));
  }
  return err<U, E>(result.error);
};

/** Curried `map` */
export const map =
  <T, U, E>(fn: (value: T) => U) =>
  (result: Result<T, E>): Result<U, E> =>
    mapResult(result, fn);

export const mapErrResult = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> => {
  if (isErr(result)) {
    return err<T, F>(fn(result.error));
  }
  return ok<T, F>(result.value);
};

export const mapErr =
  <T, E, F>(fn: (error: E) => F) =>
  (result: Result<T, E>): Result<T, F> =>
    mapErrResult(result, fn);

export const bimap = <T, U, E, F>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => F,
): Result<U, F> => {
  if (isOk(result)) {
    return ok(onOk(result.value));
  }
  return err(onErr(result.error));
};

export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return err<U, E>(result.error);
};

/** Canonical bind — Fantasy Land `chain` */
export const flatMap =
  <T, U, E>(fn: (value: T) => Result<U, E>) =>
  (result: Result<T, E>): Result<U, E> =>
    flatMapResult(result, fn);

/** neverthrow / muscle-memory alias */
export const andThen = flatMap;

/** Fantasy Land alias */
export const chain = flatMap;

/** Bind with a sync step that may change the error type */
export const flatMapResultErr = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return err<U, E | F>(result.error);
};

export const match = <T, E, U>(
  result: Result<T, E>,
  onOk: (value: T) => U,
  onErr: (error: E) => U,
): U => {
  if (isOk(result)) {
    return onOk(result.value);
  }
  return onErr(result.error);
};

/** Curried `match` */
export const matchWith =
  <T, E, U>(onOk: (value: T) => U, onErr: (error: E) => U) =>
  (result: Result<T, E>): U =>
    match(result, onOk, onErr);

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
};

/** Wrap a throwing sync function — neverthrow `Result.fromThrowable` */
export function trySync<A extends readonly unknown[], T, E>(
  fn: (...args: A) => T,
  onThrow: (error: unknown) => E,
): (...args: A) => Result<T, E>;
export function trySync<F extends (...args: never) => unknown, E>(
  fn: F,
  onThrow: (error: unknown) => E,
): (...args: Parameters<F>) => Result<ReturnType<F>, E>;
export function trySync(
  fn: (...args: never) => unknown,
  onThrow: (error: unknown) => unknown,
): (...args: never) => Result<unknown, unknown> {
  return (...args: never) => {
    try {
      return ok(fn(...args));
    } catch (error) {
      return err(onThrow(error));
    }
  };
}

/** First failure wins; otherwise collects values in order */
export const combine = <T, E>(results: readonly Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
};

/** Tuple-preserving combine (neverthrow-style) */
export const combineTuple = <const R extends readonly Result<unknown, unknown>[]>(
  results: R,
): CombineTuple<R> => {
  const values: unknown[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return err(result.error) as CombineTuple<R>;
    }
    values.push(result.value);
  }
  return ok(values) as CombineTuple<R>;
};

type CombineTuple<R extends readonly Result<unknown, unknown>[]> = Result<
  { [K in keyof R]: R[K] extends Result<infer T, unknown> ? T : never },
  { [K in keyof R]: R[K] extends Result<unknown, infer E> ? E : never }[number]
>;

export const pipe = <A, B>(value: A, fn: (value: A) => B): B => fn(value);
