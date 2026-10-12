/** @deprecated Migration shim — prefer `@onrails/result` and `@onrails/result/fluent`. */
import { ResultAsync as CoreResultAsync } from "../async.js";
import { combineTuple, validateAll } from "../collections.js";
import { mkErr as coreErr, mkOk as coreOk } from "../internal/ctor.js";
import type { InferErr, InferOk } from "../internal/infer.js";
import { fromThrowable as coreFromThrowable, isErr, isOk } from "../result.js";
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

/** Narrowed by {@link CompatResult.isOk} — exposes `value`. */
export type CompatOk<T, E> = CompatResult<T, E> & { readonly value: T };
/** Narrowed by {@link CompatResult.isErr} — exposes `error`. */
export type CompatErr<T, E> = CompatResult<T, E> & { readonly error: E };

export class CompatResult<T, E> {
  constructor(readonly inner: ResultType<T, E>) {}

  static fromThrowable<A extends readonly unknown[], U, F>(
    fn: (...args: A) => U,
    onThrow: (error: unknown) => F,
  ): (...args: A) => CompatResult<U, F> {
    const wrapped = coreFromThrowable(fn, onThrow);
    return (...args: A) => new CompatResult(wrapped(...args));
  }

  static combine<const R extends readonly CompatResult<unknown, unknown>[]>(
    results: R,
  ): CompatResult<TupleOk<R>, TupleErr<R>> {
    return new CompatResult(
      combineTuple(results.map((r) => r.inner)) as unknown as ResultType<TupleOk<R>, TupleErr<R>>,
    );
  }

  // The `as unknown as` casts below restore per-index tuple types computed from R, which TS cannot
  // relate to the runtime arrays.
  static combineWithAllErrors<const R extends readonly CompatResult<unknown, unknown>[]>(
    results: R,
  ): CompatResult<TupleOk<R>, TupleErr<R>[]> {
    return new CompatResult(
      validateAll(results.map((r) => r.inner)) as unknown as ResultType<TupleOk<R>, TupleErr<R>[]>,
    );
  }

  isOk(): this is CompatOk<T, E> {
    return isOk(this.inner);
  }

  isErr(): this is CompatErr<T, E> {
    return isErr(this.inner);
  }

  map<U>(fn: (value: T) => U): CompatResult<U, E> {
    return new CompatResult(this.inner.map(fn));
  }

  mapErr<F>(fn: (error: E) => F): CompatResult<T, F> {
    return new CompatResult(this.inner.mapErr(fn));
  }

  andThen<U, F = E>(fn: (value: T) => CompatResult<U, F>): CompatResult<U, E | F> {
    return new CompatResult(this.inner.flatMap((value) => fn(value).inner));
  }

  asyncAndThen<U, F = E>(
    fn: (value: T) => CompatResultAsync<U, F> | CoreResultAsync<U, F>,
  ): CompatResultAsync<U, E | F> {
    return isErr(this.inner)
      ? CompatResultAsync.err(this.inner.error)
      : CompatResultAsync.fromInner(coerceToCoreAsync(fn(this.inner.value)));
  }

  orElse<F>(fn: (error: E) => CompatResult<T, F>): CompatResult<T, F> {
    return isOk(this.inner)
      ? new CompatResult<T, F>(coreOk(this.inner.value))
      : fn(this.inner.error);
  }

  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): U1 | U2 {
    return isOk(this.inner) ? onOk(this.inner.value) : onErr(this.inner.error);
  }

  unwrapOr<U>(defaultValue: U): T | U {
    return this.inner.unwrapOr(defaultValue);
  }

  andTee(fn: (value: T) => unknown): CompatResult<T, E> {
    if (isOk(this.inner)) {
      try {
        fn(this.inner.value);
      } catch {
        // andTee ignores tee failures (neverthrow semantics).
      }
    }
    return this;
  }

  orTee(fn: (error: E) => unknown): CompatResult<T, E> {
    if (isErr(this.inner)) {
      try {
        fn(this.inner.error);
      } catch {
        // orTee ignores tee failures (neverthrow semantics).
      }
    }
    return this;
  }

  andThrough<F>(fn: (value: T) => CompatResult<unknown, F>): CompatResult<T, E | F> {
    if (isErr(this.inner)) return this;
    const through = fn(this.inner.value).inner;
    return isErr(through) ? new CompatResult<T, E | F>(coreErr(through.error)) : this;
  }

  asyncAndThrough<F>(
    fn: (value: T) => CompatResultAsync<unknown, F> | CoreResultAsync<unknown, F>,
  ): CompatResultAsync<T, E | F> {
    const inner = this.inner;
    return CompatResultAsync.fromInner(
      CoreResultAsync.defer(async (): Promise<ResultType<T, E | F>> => {
        if (isErr(inner)) return inner;
        const through = await coerceToCoreAsync(fn(inner.value)).resolve();
        return isErr(through) ? coreErr(through.error) : inner;
      }),
    );
  }

  asyncMap<U>(fn: (value: T) => Promise<U>): CompatResultAsync<U, E> {
    return isErr(this.inner)
      ? CompatResultAsync.err(this.inner.error)
      : CompatResultAsync.fromSafePromise(fn(this.inner.value));
  }

  /** Yields the `Err` to {@link safeTry} on failure; returns the `Ok` value otherwise. */
  *safeUnwrap(): Generator<CompatResult<never, E>, T, unknown> {
    if (isErr(this.inner)) {
      yield new CompatResult<never, E>(coreErr(this.inner.error));
    }
    // Only reachable on Err when driven outside safeTry — same failure neverthrow raises.
    return this._unsafeUnwrap();
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

// `value` / `error` are installed on the prototype rather than declared in the class body so the
// plain `CompatResult` type hides them until `isOk()` / `isErr()` narrows, as with neverthrow.
Object.defineProperty(CompatResult.prototype, "value", {
  get(this: CompatResult<unknown, unknown>) {
    return this._unsafeUnwrap();
  },
});
Object.defineProperty(CompatResult.prototype, "error", {
  get(this: CompatResult<unknown, unknown>) {
    return this._unsafeUnwrapErr();
  },
});

/** `instanceof Ok` matches any `CompatResult` holding a value, as neverthrow's `Ok` class does. */
export class Ok<T, E> extends CompatResult<T, E> {
  declare readonly value: T;
  constructor(value: T) {
    super(coreOk(value));
  }
  static [Symbol.hasInstance](candidate: unknown): boolean {
    return candidate instanceof CompatResult && isOk(candidate.inner);
  }
}

/** `instanceof Err` matches any `CompatResult` holding an error, as neverthrow's `Err` class does. */
export class Err<T, E> extends CompatResult<T, E> {
  declare readonly error: E;
  constructor(error: E) {
    super(coreErr(error));
  }
  static [Symbol.hasInstance](candidate: unknown): boolean {
    return candidate instanceof CompatResult && isErr(candidate.inner);
  }
}

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
    return new CompatResultAsync(CoreResultAsync.ok<T, E>(value));
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

  static combineWithAllErrors<const R extends readonly CompatResultAsync<unknown, unknown>[]>(
    results: R,
  ): CompatResultAsync<AsyncTupleOk<R>, AsyncTupleErr<R>[]> {
    return new CompatResultAsync(
      CoreResultAsync.defer(
        async () =>
          validateAll(await Promise.all(results.map((r) => r.resolve()))) as unknown as ResultType<
            AsyncTupleOk<R>,
            AsyncTupleErr<R>[]
          >,
      ),
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

  andThrough<R extends AnyAsyncOrSyncResult>(
    fn: (value: T) => R,
  ): CompatResultAsync<T, E | UnwrapErr<R>> {
    return new CompatResultAsync(
      CoreResultAsync.defer(async (): Promise<ResultType<T, E | UnwrapErr<R>>> => {
        const r = await this.inner.resolve();
        if (isErr(r)) return r;
        const next = coerceToCore(fn(r.value));
        const through = next instanceof CoreResultAsync ? await next.resolve() : next;
        return isErr(through) ? coreErr(through.error) : r;
      }),
    );
  }

  /** Async twin of {@link CompatResult.safeUnwrap}. */
  async *safeUnwrap(): AsyncGenerator<CompatResult<never, E>, T, unknown> {
    return yield* new CompatResult(await this.inner.resolve()).safeUnwrap();
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

export function safeTry<T, E>(
  body: () => Generator<CompatResult<never, E>, CompatResult<T, E>, unknown>,
): CompatResult<T, E>;
export function safeTry<T, E>(
  body: () => AsyncGenerator<CompatResult<never, E>, CompatResult<T, E>, unknown>,
): CompatResultAsync<T, E>;
export function safeTry<T, E>(
  body: () =>
    | Generator<CompatResult<never, E>, CompatResult<T, E>, unknown>
    | AsyncGenerator<CompatResult<never, E>, CompatResult<T, E>, unknown>,
): CompatResult<T, E> | CompatResultAsync<T, E> {
  // A yielded Err and the returned Result both end the first step, so one `next()` decides the outcome.
  const step = body().next();
  if (step instanceof Promise) {
    return CompatResultAsync.fromInner(CoreResultAsync.defer(async () => (await step).value.inner));
  }
  return step.value;
}

export const okAsync = CompatResultAsync.ok;
export const errAsync = CompatResultAsync.err;
export const fromPromise = CompatResultAsync.fromPromise;
export const fromSafePromise = CompatResultAsync.fromSafePromise;

export const fromThrowable = CompatResult.fromThrowable;
export const fromAsyncThrowable = CompatResultAsync.fromThrowable;
