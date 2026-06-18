import { err, isErr, map, mapErr, ok } from "./result.js";
import type { Result } from "./types.js";
import { UnexpectedError } from "./types.js";

type PromiseFactory<T, E> = () => Promise<Result<T, E>>;
type AsyncOk<R> = R extends ResultAsync<infer T, unknown> ? T : never;
type AsyncErr<R> = R extends ResultAsync<unknown, infer E> ? E : never;
type CombineTupleAsync<R extends readonly ResultAsync<unknown, unknown>[]> = ResultAsync<
  { [K in keyof R]: AsyncOk<R[K]> },
  { [K in keyof R]: AsyncErr<R[K]> }[number]
>;

const liftPromiseResult = async <T, E>(
  promise: Promise<Result<T, E>>,
  onDefect: (error: unknown) => E | UnexpectedError,
): Promise<Result<T, E | UnexpectedError>> => {
  try {
    const result = await promise;
    if (isErr(result)) {
      return result;
    }
    // Auto-flatten one level: Ok<Result<…>> from double-wrapped interop.
    return isResultLike<T, E | UnexpectedError>(result.value) ? result.value : result;
  } catch (error) {
    return err(onDefect(error));
  }
};

/** Collapses settled results left-to-right, short-circuiting on the first `Err`. */
const sequenceSettled = (
  settled: readonly Result<unknown, unknown>[],
): Result<unknown[], unknown> => {
  const values: unknown[] = [];
  for (const result of settled) {
    if (isErr(result)) {
      return err(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
};

/**
 * Async result — public API never exposes `Promise<Result<…>>` directly;
 * await via `.resolve()` or `.match()`.
 */
export class ResultAsync<T, E> {
  private promise: Promise<Result<T, E>> | null = null;

  protected constructor(protected readonly run: PromiseFactory<T, E>) {}

  static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
    return new ResultAsync(async () => result);
  }

  static fromPromise<T, E>(
    promise: PromiseLike<T>,
    onReject: (error: unknown) => E,
  ): ResultAsync<T, E> {
    return new ResultAsync(async () => {
      try {
        return ok(await promise);
      } catch (error) {
        return err(onReject(error));
      }
    });
  }

  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E> {
    return new ResultAsync(async () => ok(await promise));
  }

  /**
   * Defers work until {@link resolve}. Unlike {@link fromPromise}, nothing runs
   * until the `ResultAsync` is resolved (e.g. by `combineTuple` / `combineTupleParallel`).
   */
  static defer<T, E>(fn: () => Promise<Result<T, E>>): ResultAsync<T, E> {
    return new ResultAsync(fn);
  }

  static ok<T>(value: T): ResultAsync<T, never>;
  static ok<T, E>(value: T): ResultAsync<T, E>;
  static ok<T, E = never>(value: T): ResultAsync<T, E> {
    return new ResultAsync(async () => ok(value));
  }

  static err<T = never, E = unknown>(error: E): ResultAsync<T, E> {
    return new ResultAsync(async () => err(error));
  }

  /** @see {@link fromAsync} from `@onrails/result/interop` */
  static fromResultPromise<T, E>(
    promise: Promise<Result<T, E>>,
    onDefect?: (error: unknown) => E | UnexpectedError,
  ): ResultAsync<T, E | UnexpectedError> {
    const mapDefect =
      onDefect ?? ((error: unknown) => new UnexpectedError("Unexpected async defect", error));
    return new ResultAsync(() => liftPromiseResult(promise, mapDefect));
  }

  static combine<T, E>(results: readonly ResultAsync<T, E>[]): ResultAsync<T[], E> {
    return new ResultAsync(async () => {
      const values: T[] = [];
      for (const ra of results) {
        const result = await ra.resolve();
        if (isErr(result)) {
          return err(result.error);
        }
        values.push(result.value);
      }
      return ok(values);
    });
  }

  static combineTuple<const R extends readonly ResultAsync<unknown, unknown>[]>(
    results: R,
  ): CombineTupleAsync<R> {
    // Runtime identical to combine; the cast restores per-index tuple types.
    return ResultAsync.combine(
      results as readonly ResultAsync<unknown, unknown>[],
    ) as CombineTupleAsync<R>;
  }

  /**
   * Like {@link combineTuple}, but starts every branch before awaiting (wall-clock
   * parallel for independent IO). On failure, returns the first `Err` in input order.
   */
  static combineTupleParallel<const R extends readonly ResultAsync<unknown, unknown>[]>(
    results: R,
  ): CombineTupleAsync<R> {
    // Cast restores per-index tuple types over the untyped sequence core.
    return new ResultAsync(async () =>
      sequenceSettled(await Promise.all(results.map((ra) => ra.resolve()))),
    ) as CombineTupleAsync<R>;
  }

  map<U>(fn: (value: T) => U): ResultAsync<U, E> {
    return new ResultAsync(async () => map(await this.resolve(), fn));
  }

  mapErr<F>(fn: (error: E) => F): ResultAsync<T, F> {
    return new ResultAsync(async () => mapErr(await this.resolve(), fn));
  }

  flatMap<U, F = E>(
    fn: (value: T) => ResultAsync<U, F> | Result<U, F> | { inner: Result<U, F> },
  ): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(async () => {
      const first = await this.resolve();
      if (isErr(first)) {
        return first;
      }
      const next = fn(first.value);
      if (next instanceof ResultAsync) {
        return next.resolve();
      }
      if (isResultLike<U, F>(next)) {
        return next;
      }
      return isCompatLike<U, F>(next) ? next.inner : next;
    });
  }

  andThen<U, F = E>(
    fn: (value: T) => ResultAsync<U, F> | Result<U, F> | { inner: Result<U, F> },
  ): ResultAsync<U, E | F> {
    return this.flatMap(fn);
  }

  recover<F>(fn: (error: E) => ResultAsync<T, F> | Result<T, F>): ResultAsync<T, F> {
    return new ResultAsync<T, F>(async () => {
      const first = await this.resolve();
      if (!isErr(first)) {
        return first;
      }
      const next = fn(first.error);
      return next instanceof ResultAsync ? next.resolve() : next;
    });
  }

  orElse<F>(fn: (error: E) => ResultAsync<T, F> | Result<T, F>): ResultAsync<T, F> {
    return this.recover(fn);
  }

  tap(fn: (value: T) => void): ResultAsync<T, E> {
    return new ResultAsync(async () => {
      const result = await this.resolve();
      if (!isErr(result)) {
        fn(result.value);
      }
      return result;
    });
  }

  tapErr(fn: (error: E) => void): ResultAsync<T, E> {
    return new ResultAsync(async () => {
      const result = await this.resolve();
      if (isErr(result)) {
        fn(result.error);
      }
      return result;
    });
  }

  unwrapOr<U>(defaultValue: U): Promise<T | U> {
    return this.resolve().then((result) => (isErr(result) ? defaultValue : result.value));
  }

  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): Promise<U1 | U2> {
    return this.resolve().then((result) =>
      isErr(result) ? onErr(result.error) : onOk(result.value),
    );
  }

  resolve(): Promise<Result<T, E>> {
    if (!this.promise) {
      this.promise = this.run();
    }
    return this.promise;
  }

  /**
   * Thenable shim — `await ra` resolves to a bare tagged-union `Result<T, E>`.
   * Narrow with `isOk(r)` / `isErr(r)` to read `.value` / `.error`.
   */
  // biome-ignore lint/suspicious/noThenProperty: makes ResultAsync awaitable
  then<R1 = Result<T, E>, R2 = never>(
    onfulfilled?: ((value: Result<T, E>) => R1 | PromiseLike<R1>) | undefined | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | undefined | null,
  ): Promise<R1 | R2> {
    return this.resolve().then(
      // Safe: without onfulfilled, R1 stays at its Result<T, E> default.
      (r) => (onfulfilled ? onfulfilled(r) : (r as unknown as R1)),
      onrejected ?? undefined,
    );
  }
}

function isResultLike<U, F>(v: unknown): v is Result<U, F> {
  return (
    typeof v === "object" &&
    v !== null &&
    "_tag" in v &&
    ((v as { _tag: unknown })._tag === "Ok" || (v as { _tag: unknown })._tag === "Err")
  );
}

function isCompatLike<U, F>(v: unknown): v is { inner: Result<U, F> } {
  return (
    typeof v === "object" &&
    v !== null &&
    "inner" in v &&
    isResultLike((v as { inner: unknown }).inner)
  );
}

/**
 * Lifts a value into an `Ok` async result.
 *
 * @example
 * ```ts
 * const r = okAsync(42);                  // ResultAsync<number, never>
 * ```
 */
export const okAsync = ResultAsync.ok;

/**
 * Lifts a value into an `Err` async result.
 *
 * @example
 * ```ts
 * const r = errAsync({ kind: "not_found" as const });
 * ```
 */
export const errAsync = ResultAsync.err;

/**
 * Wraps a `PromiseLike<T>` into a {@link ResultAsync}. Reject reasons go
 * through `onReject` to become typed `Err`s; success becomes `Ok<T>`.
 *
 * @example
 * ```ts
 * const body = fromPromise(
 *   fetch(url).then((r) => r.text()),
 *   (e): NetworkError => ({ kind: "network", cause: String(e) }),
 * );
 * ```
 */
export const fromPromise = ResultAsync.fromPromise;

/**
 * Wraps a `PromiseLike<T>` that **never rejects** into {@link ResultAsync}.
 * Skips the `onReject` mapper. Use only when the promise is provably safe.
 */
export const fromSafePromise = ResultAsync.fromSafePromise;

/**
 * Heterogeneous async tuple combine — branches overlap in wall-clock time.
 * Returns the first `Err` in **input** order (not completion order).
 *
 * @example
 * ```ts
 * const combined = parallelTupleAsync([
 *   loadProfile(id),
 *   loadMetrics(id),
 *   loadFlags(id),
 * ] as const);
 * // ResultAsync<readonly [Profile, Metrics, Flags], …>
 * ```
 */
export const parallelTupleAsync = ResultAsync.combineTupleParallel;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Convenience wrapper over {@link fromPromise} with default `Error`
 * normalization. Call without `onReject` to get `ResultAsync<T, Error>`,
 * or pass a custom mapper for a typed error.
 *
 * @example
 * ```ts
 * // Default: rejection → Err(Error)
 * const a = tryAsync(db.users.insert(row));
 *
 * // Custom: typed error
 * const b = tryAsync(db.users.insert(row), (e): DbError => ({
 *   kind: "db",
 *   cause: e,
 * }));
 * ```
 */
export function tryAsync<T>(promise: PromiseLike<T>): ResultAsync<T, Error>;
export function tryAsync<T, E>(
  promise: PromiseLike<T>,
  onReject: (error: unknown) => E,
): ResultAsync<T, E>;
export function tryAsync<T, E>(
  promise: PromiseLike<T>,
  onReject?: (error: unknown) => E,
): ResultAsync<T, E | Error> {
  return onReject
    ? ResultAsync.fromPromise(promise, onReject)
    : ResultAsync.fromPromise(promise, toError);
}
