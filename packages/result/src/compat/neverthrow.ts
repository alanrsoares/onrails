/**
 * Temporary neverthrow-shaped API for phased migration.
 * @deprecated Prefer `@onrails/result` and `@onrails/result/fluent`.
 */
import { ResultAsync as CoreResultAsync } from "../async.js";
import {
  combine,
  combineTuple,
  err as coreErr,
  ok as coreOk,
  flatMapResultErr,
  isErr,
  isOk,
  mapErrResult,
  mapResult,
  trySync,
  unwrapOr,
} from "../result.js";
import type { Result as ResultType } from "../types.js";

/** Class-shaped Result for neverthrow call sites (`.andThen`, etc.) */
export class CompatResult<T, E> {
  constructor(readonly inner: ResultType<T, E>) {}

  static fromThrowable<A extends readonly unknown[], U, F>(
    fn: (...args: A) => U,
    onThrow: (error: unknown) => F,
  ): (...args: A) => CompatResult<U, F> {
    const wrapped = trySync(fn, onThrow);
    return (...args: A) => new CompatResult(wrapped(...args));
  }

  static combine<const R extends readonly CompatResult<unknown, unknown>[]>(
    results: R,
  ): CompatResult<
    { [K in keyof R]: R[K] extends CompatResult<infer T, unknown> ? T : never },
    { [K in keyof R]: R[K] extends CompatResult<unknown, infer F> ? F : never }[number]
  > {
    const inners = results.map((r) => r.inner);
    return new CompatResult(
      combineTuple(inners) as ResultType<
        { [K in keyof R]: R[K] extends CompatResult<infer T, unknown> ? T : never },
        { [K in keyof R]: R[K] extends CompatResult<unknown, infer F> ? F : never }[number]
      >,
    );
  }

  /** Throws when accessed on Err — guard with `isOk()` first. */
  get value(): T {
    if (isErr(this.inner)) {
      throw new Error("Accessed .value on Err");
    }
    return this.inner.value;
  }

  /** Throws when accessed on Ok — guard with `isErr()` first. */
  get error(): E {
    if (isOk(this.inner)) {
      throw new Error("Accessed .error on Ok");
    }
    return this.inner.error;
  }

  isOk(): boolean {
    return isOk(this.inner);
  }

  isErr(): boolean {
    return isErr(this.inner);
  }

  map<U>(fn: (value: T) => U): CompatResult<U, E> {
    return new CompatResult(mapResult(this.inner, fn));
  }

  mapErr<F>(fn: (error: E) => F): CompatResult<T, F> {
    return new CompatResult(mapErrResult(this.inner, fn));
  }

  andThen<U, F = E>(fn: (value: T) => CompatResult<U, F>): CompatResult<U, E | F> {
    return new CompatResult(flatMapResultErr(this.inner, (value) => fn(value).inner));
  }

  asyncAndThen<U, F = E>(
    fn: (value: T) => CompatResultAsync<U, F> | CoreResultAsync<U, F>,
  ): CompatResultAsync<U, E | F> {
    if (isErr(this.inner)) {
      return CompatResultAsync.err<U, E | F>(this.inner.error);
    }
    const next = fn(this.inner.value);
    return CompatResultAsync.fromInner(
      next instanceof CompatResultAsync ? next.toCore() : (next as CoreResultAsync<U, F>),
    ) as CompatResultAsync<U, E | F>;
  }

  orElse<F>(fn: (error: E) => CompatResult<T, F>): CompatResult<T, F> {
    if (isOk(this.inner)) {
      return new CompatResult(this.inner as ResultType<T, F>);
    }
    return fn(this.inner.error);
  }

  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): U1 | U2 {
    return isOk(this.inner) ? onOk(this.inner.value) : onErr(this.inner.error);
  }

  unwrapOr<U>(defaultValue: U): T | U {
    return unwrapOr(this.inner as ResultType<T | U, E>, defaultValue);
  }

  _unsafeUnwrap(): T {
    if (isErr(this.inner)) {
      throw new Error("Called _unsafeUnwrap on Err");
    }
    return this.inner.value;
  }

  _unsafeUnwrapErr(): E {
    if (isOk(this.inner)) {
      throw new Error("Called _unsafeUnwrapErr on Ok");
    }
    return this.inner.error;
  }
}

/** neverthrow `Result` class (static methods + instance type) */
export const Result = CompatResult;

export type Result<T, E> = CompatResult<T, E>;

export const ok = <T, E = never>(value: T): CompatResult<T, E> => new CompatResult(coreOk(value));

export const err = <T = never, E = unknown>(error: E): CompatResult<T, E> =>
  new CompatResult(coreErr(error));

export const combineResults = <T, E>(results: CompatResult<T, E>[]): CompatResult<T[], E> =>
  new CompatResult(combine(results.map((r) => r.inner)));

/**
 * Awaitable, neverthrow-shaped async result.
 * `await` resolves to a `CompatResult<T, E>` so `.isOk()`, `.value`, `.error`,
 * `.match()` work without an extra `.resolve()` call.
 */
export class CompatResultAsync<T, E> implements PromiseLike<CompatResult<T, E>> {
  private constructor(private readonly inner: CoreResultAsync<T, E>) {}

  static fromInner<T, E>(inner: CoreResultAsync<T, E>): CompatResultAsync<T, E> {
    return new CompatResultAsync(inner);
  }

  toCore(): CoreResultAsync<T, E> {
    return this.inner;
  }

  static ok<T, E = never>(value: T): CompatResultAsync<T, E> {
    return new CompatResultAsync(CoreResultAsync.ok(value));
  }

  static err<T = never, E = unknown>(error: E): CompatResultAsync<T, E> {
    return new CompatResultAsync(CoreResultAsync.err<T, E>(error));
  }

  static fromPromise<T, E>(
    promise: PromiseLike<T>,
    onReject: (error: unknown) => E,
  ): CompatResultAsync<T, E> {
    return new CompatResultAsync(CoreResultAsync.fromPromise(promise, onReject));
  }

  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): CompatResultAsync<T, E> {
    return new CompatResultAsync(CoreResultAsync.fromSafePromise<T, E>(promise));
  }

  static fromThrowable<A extends readonly unknown[], U, F>(
    fn: (...args: A) => Promise<U>,
    onThrow: (error: unknown) => F,
  ): (...args: A) => CompatResultAsync<U, F> {
    return (...args: A) =>
      CompatResultAsync.fromPromise(
        Promise.resolve().then(() => fn(...args)),
        onThrow,
      );
  }

  static combine<const R extends readonly CompatResultAsync<unknown, unknown>[]>(
    results: R,
  ): CompatResultAsync<
    { [K in keyof R]: R[K] extends CompatResultAsync<infer T, unknown> ? T : never },
    { [K in keyof R]: R[K] extends CompatResultAsync<unknown, infer F> ? F : never }[number]
  > {
    const cores = results.map((r) => r.inner) as readonly CoreResultAsync<unknown, unknown>[];
    return new CompatResultAsync(
      CoreResultAsync.combine(cores) as CoreResultAsync<
        { [K in keyof R]: R[K] extends CompatResultAsync<infer T, unknown> ? T : never },
        { [K in keyof R]: R[K] extends CompatResultAsync<unknown, infer F> ? F : never }[number]
      >,
    );
  }

  // biome-ignore lint/suspicious/noThenProperty: thenable shim for `await ra` -> CompatResult
  then<R1 = CompatResult<T, E>, R2 = never>(
    onfulfilled?: ((value: CompatResult<T, E>) => R1 | PromiseLike<R1>) | undefined | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | undefined | null,
  ): Promise<R1 | R2> {
    return this.inner.resolve().then((r) => {
      const wrapped = new CompatResult(r);
      return onfulfilled ? onfulfilled(wrapped) : (wrapped as unknown as R1);
    }, onrejected ?? undefined);
  }

  resolve(): Promise<ResultType<T, E>> {
    return this.inner.resolve();
  }

  map<U>(fn: (value: T) => U): CompatResultAsync<U, E> {
    return new CompatResultAsync(this.inner.map(fn));
  }

  mapErr<F>(fn: (error: E) => F): CompatResultAsync<T, F> {
    return new CompatResultAsync(this.inner.mapErr(fn));
  }

  andThen<R extends AnyAsyncOrSyncResult>(
    fn: (value: T) => R,
  ): CompatResultAsync<UnwrapOk<R>, E | UnwrapErr<R>> {
    return new CompatResultAsync(
      this.inner.andThen((value) => coerceToCore(fn(value))) as CoreResultAsync<
        UnwrapOk<R>,
        E | UnwrapErr<R>
      >,
    );
  }

  chain<R extends AnyAsyncOrSyncResult>(
    fn: (value: T) => R,
  ): CompatResultAsync<UnwrapOk<R>, E | UnwrapErr<R>> {
    return this.andThen(fn);
  }

  flatMap<R extends AnyAsyncOrSyncResult>(
    fn: (value: T) => R,
  ): CompatResultAsync<UnwrapOk<R>, E | UnwrapErr<R>> {
    return this.andThen(fn);
  }

  flatMapResult<U, F>(fn: (value: T) => ResultType<U, F>): CompatResultAsync<U, E | F> {
    return new CompatResultAsync(this.inner.flatMapResult(fn));
  }

  andThenResult<U, F>(fn: (value: T) => ResultType<U, F>): CompatResultAsync<U, E | F> {
    return this.flatMapResult(fn);
  }

  orElse<R extends AnyAsyncOrSyncResult>(
    fn: (error: E) => R,
  ): CompatResultAsync<T | UnwrapOk<R>, UnwrapErr<R>> {
    const coerced = (error: E) =>
      coerceToCore(fn(error)) as CoreResultAsync<T, UnwrapErr<R>> | ResultType<T, UnwrapErr<R>>;
    return new CompatResultAsync(
      this.inner.orElse(coerced) as CoreResultAsync<T | UnwrapOk<R>, UnwrapErr<R>>,
    );
  }

  unwrapOr<U>(defaultValue: U): Promise<T | U> {
    return this.inner.unwrapOr(defaultValue);
  }

  isOk(): Promise<boolean> {
    return this.inner.isOk();
  }

  isErr(): Promise<boolean> {
    return this.inner.isErr();
  }

  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): Promise<U1 | U2> {
    return this.inner.resolve().then((r) => (isOk(r) ? onOk(r.value) : onErr(r.error)));
  }

  /** Tap on success — runs side-effect with the value, passes through. */
  andTee(fn: (value: T) => void | Promise<void>): CompatResultAsync<T, E> {
    return new CompatResultAsync(
      CoreResultAsync.fromResultPromise(
        this.inner.resolve().then(async (r) => {
          if (!isErr(r)) await fn(r.value);
          return r;
        }),
      ) as CoreResultAsync<T, E>,
    );
  }

  /** Tap on failure — runs side-effect with the error, passes through. */
  orTee(fn: (error: E) => void | Promise<void>): CompatResultAsync<T, E> {
    return new CompatResultAsync(
      CoreResultAsync.fromResultPromise(
        this.inner.resolve().then(async (r) => {
          if (isErr(r)) await fn(r.error);
          return r;
        }),
      ) as CoreResultAsync<T, E>,
    );
  }
}

/** Any sync or async result-like value accepted by `andThen` / `orElse`. */
type AnyAsyncOrSyncResult =
  | CompatResultAsync<unknown, unknown>
  | CoreResultAsync<unknown, unknown>
  | CompatResult<unknown, unknown>
  | ResultType<unknown, unknown>;

type UnwrapOk<R> =
  R extends CompatResultAsync<infer U, unknown>
    ? U
    : R extends CoreResultAsync<infer U, unknown>
      ? U
      : R extends CompatResult<infer U, unknown>
        ? U
        : R extends ResultType<infer U, unknown>
          ? U
          : never;

type UnwrapErr<R> =
  R extends CompatResultAsync<unknown, infer F>
    ? F
    : R extends CoreResultAsync<unknown, infer F>
      ? F
      : R extends CompatResult<unknown, infer F>
        ? F
        : R extends ResultType<unknown, infer F>
          ? F
          : never;

function coerceToCore<U, F>(
  next: CompatResultAsync<U, F> | CoreResultAsync<U, F> | CompatResult<U, F> | ResultType<U, F>,
): CoreResultAsync<U, F> | ResultType<U, F> {
  if (next instanceof CompatResultAsync) return next.toCore();
  if (next instanceof CoreResultAsync) return next;
  if (next instanceof CompatResult) return next.inner;
  return next as ResultType<U, F>;
}

export { CompatResultAsync as ResultAsync };

export const okAsync = CompatResultAsync.ok;
export const errAsync = CompatResultAsync.err;
export const fromPromise = CompatResultAsync.fromPromise;
export const fromSafePromise = CompatResultAsync.fromSafePromise;
