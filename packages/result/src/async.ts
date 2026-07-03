import type { InferErr, InferOk } from "./internal/infer.js";
import { err, isErr, map, mapErr, ok } from "./result.js";
import type { Result } from "./types.js";
import { UnexpectedError } from "./types.js";

type PromiseFactory<T, E> = () => Promise<Result<T, E>>;
type CombineTupleAsync<R extends readonly ResultAsync<unknown, unknown>[]> = ResultAsync<
  { [K in keyof R]: InferOk<R[K]> },
  { [K in keyof R]: InferErr<R[K]> }[number]
>;

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
 * Async railway carrier. Wraps a deferred `Promise<Result<T, E>>` and exposes
 * the same dual-track transforms as the sync {@link Result} — `map`, `flatMap`,
 * `recover`, `tap`, `match`. The public API never surfaces `Promise<Result<…>>`
 * directly: `await` the instance (it is thenable) or call {@link resolve} /
 * {@link match} to settle it.
 *
 * Construct via the static factories ({@link ok}, {@link err}, {@link fromPromise},
 * {@link defer}, …) rather than `new` — the constructor is `protected`.
 *
 * @typeParam T - the `Ok` value type
 * @typeParam E - the `Err` error type
 *
 * @example
 * ```ts
 * const user = ResultAsync.fromPromise(api.getUser(id), toAppError)
 *   .map((u) => u.profile)
 *   .recover(() => ResultAsync.ok(guestProfile));
 *
 * const r = await user;          // Result<Profile, AppError>
 * ```
 */
export class ResultAsync<T, E> {
  private promise: Promise<Result<T, E>> | null = null;

  protected constructor(protected readonly run: PromiseFactory<T, E>) {}

  /**
   * Lifts an already-settled sync {@link Result} into a {@link ResultAsync}.
   *
   * @example
   * ```ts
   * const ra = ResultAsync.fromResult(ok(42));   // ResultAsync<number, never>
   * ```
   */
  static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
    return new ResultAsync(async () => result);
  }

  /**
   * Wraps a `PromiseLike<T>` that may reject. Rejections pass through `onReject`
   * to become a typed `Err`; resolution becomes `Ok<T>`.
   *
   * @param promise - the promise to wrap
   * @param onReject - maps a rejection reason to the `Err` channel
   *
   * @example
   * ```ts
   * const body = ResultAsync.fromPromise(
   *   fetch(url).then((r) => r.text()),
   *   (e): NetError => ({ kind: "net", cause: String(e) }),
   * );
   * ```
   */
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

  /**
   * Wraps a `PromiseLike<T>` that is **guaranteed not to reject**, skipping the
   * `onReject` mapper. Use only when rejection is provably impossible.
   *
   * @example
   * ```ts
   * const now = ResultAsync.fromSafePromise(Promise.resolve(Date.now()));
   * ```
   */
  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E> {
    return new ResultAsync(async () => ok(await promise));
  }

  /**
   * Defers work until {@link resolve}. Unlike {@link fromPromise}, the factory
   * does not run until the `ResultAsync` is resolved (e.g. by `combineTuple` /
   * `combineTupleParallel`). The factory runs at most once — `resolve` memoizes.
   *
   * @example
   * ```ts
   * const insert = ResultAsync.defer(() => db.orders.insert(row));
   * // nothing has run yet
   * const r = await insert;   // factory runs exactly once here
   * ```
   */
  static defer<T, E>(fn: () => Promise<Result<T, E>>): ResultAsync<T, E> {
    return new ResultAsync(fn);
  }

  /**
   * Lifts a value into an `Ok` async result.
   *
   * @example
   * ```ts
   * const r = ResultAsync.ok(42);   // ResultAsync<number, never>
   * ```
   */
  static ok<T>(value: T): ResultAsync<T, never>;
  static ok<T, E>(value: T): ResultAsync<T, E>;
  static ok<T, E = never>(value: T): ResultAsync<T, E> {
    return new ResultAsync(async () => ok(value));
  }

  /**
   * Fantasy Land `pure` — alias of {@link ResultAsync.ok}. One lift name
   * shared across the trio (`of` / `Maybe.of` / `ResultAsync.of`).
   */
  static of<T>(value: T): ResultAsync<T, never>;
  static of<T, E>(value: T): ResultAsync<T, E>;
  static of<T, E = never>(value: T): ResultAsync<T, E> {
    return ResultAsync.ok(value);
  }

  /**
   * Lifts an error into an `Err` async result.
   *
   * @example
   * ```ts
   * const r = ResultAsync.err({ kind: "not_found" as const });
   * ```
   */
  static err<T = never, E = unknown>(error: E): ResultAsync<T, E> {
    return new ResultAsync(async () => err(error));
  }

  /**
   * Lifts an existing `Promise<Result<T, E>>` (e.g. from interop code) into a
   * {@link ResultAsync}. A thrown defect is routed through `onDefect`,
   * defaulting to {@link UnexpectedError}. The `Ok` value passes through
   * verbatim — even when it happens to be Result-shaped.
   *
   * @param promise - a promise that already yields a `Result`
   * @param onDefect - maps an unexpected throw to the `Err` channel
   * @see {@link fromAsync} from `@onrails/result`
   */
  static fromResultPromise<T, E>(
    promise: Promise<Result<T, E>>,
    onDefect?: (error: unknown) => E | UnexpectedError,
  ): ResultAsync<T, E | UnexpectedError> {
    const mapDefect =
      onDefect ?? ((error: unknown) => new UnexpectedError("Unexpected async defect", error));
    return new ResultAsync<T, E | UnexpectedError>(async () => {
      try {
        return await promise;
      } catch (error) {
        return err(mapDefect(error));
      }
    });
  }

  /**
   * Combines a homogeneous array of async results into one. Resolves
   * **sequentially** in input order, short-circuiting on the first `Err`.
   * For heterogeneous tuples that preserve per-index types, use
   * {@link combineTuple}; for wall-clock overlap, {@link combineTupleParallel}.
   *
   * @example
   * ```ts
   * const all = ResultAsync.combine([loadA(), loadB(), loadC()]);
   * // ResultAsync<Item[], LoadError>
   * ```
   */
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

  /**
   * Heterogeneous async tuple combine — resolves branches **sequentially**
   * (left-to-right), returning the first `Err` in input order. Preserves each
   * branch's `Ok` type by position, so the result destructures type-safely.
   * This is the canonical sequential async combine (replaces the former
   * `sequenceTupleAsync`).
   *
   * @example
   * ```ts
   * const combined = ResultAsync.combineTuple([loadCfg(), loadCatalog()] as const);
   * // ResultAsync<readonly [Cfg, Catalog], CfgError | CatalogError>
   * const r = await combined;
   * if (isOk(r)) {
   *   const [cfg, catalog] = r.value;  // typed per position
   * }
   * ```
   */
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
   *
   * @example
   * ```ts
   * // independent IO — overlap them
   * const combined = ResultAsync.combineTupleParallel([
   *   loadProfile(id),
   *   loadMetrics(id),
   * ] as const);
   * ```
   */
  static combineTupleParallel<const R extends readonly ResultAsync<unknown, unknown>[]>(
    results: R,
  ): CombineTupleAsync<R> {
    // Cast restores per-index tuple types over the untyped sequence core.
    return new ResultAsync(async () =>
      sequenceSettled(await Promise.all(results.map((ra) => ra.resolve()))),
    ) as CombineTupleAsync<R>;
  }

  /**
   * Transforms the `Ok` value, passing `Err` through unchanged.
   *
   * @example
   * ```ts
   * ResultAsync.ok(2).map((n) => n * 3);   // ResultAsync<number> → Ok 6
   * ```
   */
  map<U>(fn: (value: T) => U): ResultAsync<U, E> {
    return new ResultAsync(async () => map(await this.resolve(), fn));
  }

  /**
   * Transforms the `Err` value, passing `Ok` through unchanged — useful for
   * unifying heterogeneous failures into one app-level union.
   *
   * @example
   * ```ts
   * load(id).mapErr((e): AppError => ({ kind: "load", cause: e })); // ResultAsync<T, AppError>
   * ```
   */
  mapErr<F>(fn: (error: E) => F): ResultAsync<T, F> {
    return new ResultAsync(async () => mapErr(await this.resolve(), fn));
  }

  /**
   * Canonical bind — chains a step that itself returns a `ResultAsync` or sync
   * `Result`, short-circuiting on `Err`. Error types accumulate (`E | F`).
   *
   * @example
   * ```ts
   * authenticate(req)
   *   .flatMap((user) => loadProfile(user.id))   // ResultAsync
   *   .flatMap((p) => validate(p));              // sync Result also accepted
   * ```
   */
  flatMap<U, F = E>(fn: (value: T) => ResultAsync<U, F> | Result<U, F>): ResultAsync<U, E | F> {
    return new ResultAsync<U, E | F>(async () => {
      const first = await this.resolve();
      if (isErr(first)) {
        return first;
      }
      const next = fn(first.value);
      return next instanceof ResultAsync ? next.resolve() : next;
    });
  }

  /**
   * neverthrow-compat alias of {@link flatMap}. Kept as the documented compat
   * tier; prefer {@link flatMap} in new code.
   *
   * @example
   * ```ts
   * authenticate(req).andThen((user) => loadProfile(user.id));
   * ```
   */
  andThen<U, F = E>(fn: (value: T) => ResultAsync<U, F> | Result<U, F>): ResultAsync<U, E | F> {
    return this.flatMap(fn);
  }

  /**
   * Error-channel bind — runs `fn` only on `Err`, swapping in a recovery
   * `ResultAsync` or sync `Result`. `Ok` passes through. The mirror of
   * {@link flatMap} on the error track.
   *
   * @example
   * ```ts
   * loadFromCache(id).recover(() => loadFromOrigin(id)); // ResultAsync<T, F>
   * ```
   */
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

  /**
   * neverthrow-compat alias of {@link recover}. Kept as the documented compat
   * tier; prefer {@link recover} in new code.
   *
   * @example
   * ```ts
   * loadFromCache(id).orElse(() => loadFromOrigin(id));
   * ```
   */
  orElse<F>(fn: (error: E) => ResultAsync<T, F> | Result<T, F>): ResultAsync<T, F> {
    return this.recover(fn);
  }

  /**
   * Runs a side effect on the `Ok` value and passes the result through
   * unchanged; a no-op on `Err`. Mirrors {@link tapErr}.
   *
   * @example
   * ```ts
   * saveUser(u).tap((saved) => analytics.track("user_saved", saved.id));
   * ```
   */
  tap(fn: (value: T) => void): ResultAsync<T, E> {
    return new ResultAsync(async () => {
      const result = await this.resolve();
      if (!isErr(result)) {
        fn(result.value);
      }
      return result;
    });
  }

  /**
   * Runs a side effect on the `Err` value and passes the result through
   * unchanged; a no-op on `Ok`. The error-track mirror of {@link tap}.
   *
   * @example
   * ```ts
   * saveUser(u).tapErr((e) => logger.warn("save failed", e));
   * ```
   */
  tapErr(fn: (error: E) => void): ResultAsync<T, E> {
    return new ResultAsync(async () => {
      const result = await this.resolve();
      if (isErr(result)) {
        fn(result.error);
      }
      return result;
    });
  }

  /**
   * Settles to the `Ok` value, or `defaultValue` if `Err`. Terminal — returns a
   * plain `Promise`, not a `ResultAsync`.
   *
   * @example
   * ```ts
   * const profile = await loadProfile(id).unwrapOr(guestProfile);
   * ```
   */
  unwrapOr<U>(defaultValue: U): Promise<T | U> {
    return this.resolve().then((result) => (isErr(result) ? defaultValue : result.value));
  }

  /**
   * Terminal collapse — folds both tracks into a single awaited value. Returns
   * a plain `Promise`, settling the carrier exactly once.
   *
   * @param onOk - handles the `Ok` value
   * @param onErr - handles the `Err` value
   *
   * @example
   * ```ts
   * const status = await save(row).match(
   *   () => 200,
   *   (e) => (e.kind === "conflict" ? 409 : 500),
   * );
   * ```
   */
  match<U1, U2 = U1>(onOk: (value: T) => U1, onErr: (error: E) => U2): Promise<U1 | U2> {
    return this.resolve().then((result) =>
      isErr(result) ? onErr(result.error) : onOk(result.value),
    );
  }

  /**
   * Settles the carrier to a bare sync {@link Result}, memoizing so the
   * underlying factory runs at most once. Prefer `await ra` (the thenable) or
   * {@link match} in app code; use `resolve` when you need the tagged union back.
   *
   * @example
   * ```ts
   * const r = await load(id).resolve();   // Result<Data, LoadError>
   * if (isOk(r)) use(r.value);
   * ```
   */
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

/**
 * The free-function lift helpers (`okAsync`, `errAsync`, `fromPromise`,
 * `fromSafePromise`, `fromResult`, `fromAsync`, `asyncAfter`, `tryAsync`)
 * live in `./async-lift.ts` and are re-exported from the package index.
 */
