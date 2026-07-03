/** @deprecated Migration shim — prefer `@onrails/result` and `@onrails/result/fluent`. */
import { ResultAsync as CoreResultAsync } from "../async.js";
import { combineTuple } from "../collections.js";
import type { InferErr, InferOk } from "../internal/infer.js";
import {
  err as coreErr,
  ok as coreOk,
  flatMap,
  isErr,
  isOk,
  map,
  mapErr,
  trySync,
  unwrapOr,
} from "../result.js";
import type { Result as ResultType } from "../types.js";

type TupleOk<R extends readonly CompatResult<unknown, unknown>[]> = {
  [K in keyof R]: R[K] extends CompatResult<infer T, unknown> ? T : never;
};
type TupleErr<R extends readonly CompatResult<unknown, unknown>[]> = {
  [K in keyof R]: R[K] extends CompatResult<unknown, infer F> ? F : never;
}[number];

type AsyncTupleOk<R extends readonly CompatResultAsync<unknown, unknown>[]> = {
  [K in keyof R]: R[K] extends CompatResultAsync<infer T, unknown> ? T : never;
};
type AsyncTupleErr<R extends readonly CompatResultAsync<unknown, unknown>[]> = {
  [K in keyof R]: R[K] extends CompatResultAsync<unknown, infer F> ? F : never;
}[number];

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
  ): CompatResult<TupleOk<R>, TupleErr<R>> {
    return new CompatResult(
      combineTuple(results.map((r) => r.inner)) as ResultType<TupleOk<R>, TupleErr<R>>,
    );
  }

  get value(): T {
    return this._unsafeUnwrap();
  }

  get error(): E {
    return this._unsafeUnwrapErr();
  }

  isOk(): boolean {
    return isOk(this.inner);
  }

  isErr(): boolean {
    return isErr(this.inner);
  }

  map<U>(fn: (value: T) => U): CompatResult<U, E> {
    return new CompatResult(map(this.inner, fn));
  }

  mapErr<F>(fn: (error: E) => F): CompatResult<T, F> {
    return new CompatResult(mapErr(this.inner, fn));
  }

  andThen<U, F = E>(fn: (value: T) => CompatResult<U, F>): CompatResult<U, E | F> {
    return new CompatResult(flatMap(this.inner, (value) => fn(value).inner));
  }

  asyncAndThen<U, F = E>(
    fn: (value: T) => CompatResultAsync<U, F> | CoreResultAsync<U, F>,
  ): CompatResultAsync<U, E | F> {
    return isErr(this.inner)
      ? CompatResultAsync.err(this.inner.error)
      : CompatResultAsync.fromInner(coerceToCoreAsync(fn(this.inner.value)));
  }

  orElse<F>(fn: (error: E) => CompatResult<T, F>): CompatResult<T, F> {
    return isOk(this.inner) ? new CompatResult<T, F>(this.inner) : fn(this.inner.error);
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

export const Result = CompatResult;
export type Result<T, E> = CompatResult<T, E>;

export const ok = <T, E = never>(value: T): CompatResult<T, E> => new CompatResult(coreOk(value));
export const err = <T = never, E = unknown>(error: E): CompatResult<T, E> =>
  new CompatResult(coreErr(error));

/** `await` yields `CompatResult` so `.isOk()` / `.value` / `.match()` work without `.resolve()`. */
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
    return (...args: A) => CompatResultAsync.fromPromise(fn(...args), onThrow);
  }

  static combine<const R extends readonly CompatResultAsync<unknown, unknown>[]>(
    results: R,
  ): CompatResultAsync<AsyncTupleOk<R>, AsyncTupleErr<R>> {
    return new CompatResultAsync(
      CoreResultAsync.combine(results.map((r) => r.inner)) as CoreResultAsync<
        AsyncTupleOk<R>,
        AsyncTupleErr<R>
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
      // Safe: without onfulfilled, R1 stays at its CompatResult<T, E> default.
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
    return new CompatResultAsync(this.inner.andThen((value) => coerceToCore(fn(value))));
  }

  chain<R extends AnyAsyncOrSyncResult>(fn: (value: T) => R) {
    return this.andThen(fn);
  }

  flatMap<R extends AnyAsyncOrSyncResult>(fn: (value: T) => R) {
    return this.andThen(fn);
  }

  orElse<R extends AnyAsyncOrSyncResult>(
    fn: (error: E) => R,
  ): CompatResultAsync<T | UnwrapOk<R>, UnwrapErr<R>> {
    return new CompatResultAsync(
      this.inner.orElse(
        (error) =>
          coerceToCore(fn(error)) as CoreResultAsync<T, UnwrapErr<R>> | ResultType<T, UnwrapErr<R>>,
      ) as CoreResultAsync<T | UnwrapOk<R>, UnwrapErr<R>>,
    );
  }

  unwrapOr<U>(defaultValue: U): Promise<T | U> {
    return this.inner.unwrapOr(defaultValue);
  }

  isOk(): Promise<boolean> {
    return this.inner.match(
      () => true,
      () => false,
    );
  }

  isErr(): Promise<boolean> {
    return this.inner.match(
      () => false,
      () => true,
    );
  }

  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): Promise<U1 | U2> {
    return this.inner.match(onOk, onErr);
  }

  andTee(fn: (value: T) => void | Promise<void>): CompatResultAsync<T, E> {
    return new CompatResultAsync(
      CoreResultAsync.defer(async () => {
        const r = await this.inner.resolve();
        if (!isErr(r)) {
          try {
            await fn(r.value);
          } catch {
            // andTee ignores tee failures (neverthrow semantics).
          }
        }
        return r;
      }),
    );
  }

  orTee(fn: (error: E) => void | Promise<void>): CompatResultAsync<T, E> {
    return new CompatResultAsync(
      CoreResultAsync.defer(async () => {
        const r = await this.inner.resolve();
        if (isErr(r)) {
          try {
            await fn(r.error);
          } catch {
            // orTee ignores tee failures (neverthrow semantics).
          }
        }
        return r;
      }),
    );
  }
}

type AnyAsyncOrSyncResult =
  | CompatResultAsync<unknown, unknown>
  | CoreResultAsync<unknown, unknown>
  | CompatResult<unknown, unknown>
  | ResultType<unknown, unknown>;

// Compat wrappers first (they hide the payload behind `inner`), then the
// shared extractor handles core Result / ResultAsync.
type UnwrapOk<R> =
  R extends CompatResultAsync<infer U, unknown>
    ? U
    : R extends CompatResult<infer U, unknown>
      ? U
      : InferOk<R>;

type UnwrapErr<R> =
  R extends CompatResultAsync<unknown, infer F>
    ? F
    : R extends CompatResult<unknown, infer F>
      ? F
      : InferErr<R>;

function coerceToCore<R extends AnyAsyncOrSyncResult>(
  next: R,
): CoreResultAsync<UnwrapOk<R>, UnwrapErr<R>> | ResultType<UnwrapOk<R>, UnwrapErr<R>>;
function coerceToCore(
  next: AnyAsyncOrSyncResult,
): CoreResultAsync<unknown, unknown> | ResultType<unknown, unknown> {
  if (next instanceof CompatResultAsync) return next.toCore();
  if (next instanceof CoreResultAsync) return next;
  if (next instanceof CompatResult) return next.inner;
  return next;
}

/** Async-only coercion — keeps {@link CompatResult.asyncAndThen} cast-free. */
const coerceToCoreAsync = <U, F>(
  next: CompatResultAsync<U, F> | CoreResultAsync<U, F>,
): CoreResultAsync<U, F> => (next instanceof CompatResultAsync ? next.toCore() : next);

export { CompatResultAsync as ResultAsync };

export const okAsync = CompatResultAsync.ok;
export const errAsync = CompatResultAsync.err;
export const fromPromise = CompatResultAsync.fromPromise;
export const fromSafePromise = CompatResultAsync.fromSafePromise;
