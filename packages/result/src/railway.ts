import { ResultAsync } from "./async.js";
import { err, flatMap, map, ok, trySync } from "./result.js";
import type { Result } from "./types.js";

/**
 * Tracks whether a {@link Railway} workflow has crossed an async boundary.
 * Sync workflows return {@link Result}; async workflows return {@link ResultAsync}.
 */
export type RailwayMode = "sync" | "async";

/**
 * Mode-aware output type for a {@link Railway} workflow: sync mode →
 * `Result<T, E>`, async mode → `ResultAsync<T, E>`.
 */
export type RailwayOutput<T, E, M extends RailwayMode> = M extends "async"
  ? ResultAsync<T, E>
  : Result<T, E>;

/**
 * Runtime carrier for a workflow. Invariant: the `mode` tag mirrors the
 * phantom `M` on {@link Railway} — every construction site writes matching
 * tag and type parameter, and {@link Railway.step} / {@link Railway.out}
 * are the only places that re-link the two.
 */
type RailwayState<C extends object, E> =
  | { readonly mode: "sync"; readonly result: Result<C, E> }
  | { readonly mode: "async"; readonly result: ResultAsync<C, E> };

export type BranchFn<C extends object> = (ctx: C) => ResultAsync<unknown, unknown>;
export type BranchRecord = Record<string, (ctx: never) => ResultAsync<unknown, unknown>>;
type BranchOk<R> = R extends (ctx: never) => ResultAsync<infer T, infer _E> ? T : never;
type BranchErr<R> = R extends (ctx: never) => ResultAsync<infer _T, infer E> ? E : never;
export type ParallelOutput<R extends BranchRecord> = {
  [K in keyof R]: BranchOk<R[K]>;
};
export type ParallelError<R extends BranchRecord> = BranchErr<R[keyof R]>;

const addField = <C extends object, K extends string, T>(
  ctx: C,
  key: K,
  value: T,
): C & Record<K, T> => ({ ...ctx, [key]: value }) as C & Record<K, T>;

/**
 * Named-context workflow builder. Each step appends a typed field to the
 * accumulating context object; the workflow tracks sync/async mode so the
 * final output type ({@link RailwayOutput}) is correct.
 */
export class Railway<C extends object, E, M extends RailwayMode> {
  private constructor(private readonly state: RailwayState<C, E>) {}

  /** Start an empty sync workflow with no fields in context. */
  static empty(): Railway<Record<never, never>, never, "sync"> {
    return new Railway({ mode: "sync", result: ok({}) });
  }

  /** Start a sync workflow with the given context as the initial state. */
  static context<C extends object>(context: C): Railway<C, never, "sync"> {
    return new Railway({ mode: "sync", result: ok(context) });
  }

  /** Start a sync workflow with a throwing function. */
  static fromSync<K extends string, T, E>(
    key: K,
    fn: () => T,
    onThrow: (error: unknown) => E,
  ): Railway<Record<K, T>, E, "sync"> {
    return Railway.empty().fromSync(key, fn, onThrow);
  }

  /** Start a sync workflow with a `Result`-returning function. */
  static fromResult<K extends string, T, E>(
    key: K,
    fn: () => Result<T, E>,
  ): Railway<Record<K, T>, E, "sync"> {
    return Railway.empty().fromResult(key, fn);
  }

  /** Start an async workflow with a `PromiseLike`-returning function. */
  static fromPromise<K extends string, T, E>(
    key: K,
    fn: () => PromiseLike<T>,
    onReject: (error: unknown) => E,
  ): Railway<Record<K, T>, E, "async"> {
    return Railway.empty().fromPromise(key, fn, onReject);
  }

  /** Start an async workflow with a `ResultAsync`-returning function. */
  static fromAsync<K extends string, T, E>(
    key: K,
    fn: () => ResultAsync<T, E>,
  ): Railway<Record<K, T>, E, "async"> {
    return Railway.empty().fromAsync(key, fn);
  }

  /**
   * Rebuild the workflow in its current mode after transforming the carried
   * result. Single re-link point for the state/phantom invariant: the mode
   * tag is preserved verbatim, so `M` still describes the new state — TS
   * cannot narrow the phantom `M` from the runtime tag, hence the cast.
   */
  private step<C2 extends object, F>(
    onSync: (result: Result<C, E>) => Result<C2, E | F>,
    onAsync: (result: ResultAsync<C, E>) => ResultAsync<C2, E | F>,
  ): Railway<C2, E | F, M> {
    const next: RailwayState<C2, E | F> =
      this.state.mode === "sync"
        ? { mode: "sync", result: onSync(this.state.result) }
        : { mode: "async", result: onAsync(this.state.result) };
    return new Railway(next) as Railway<C2, E | F, M>;
  }

  /**
   * Project the carried result into the mode-aware output type. Counterpart
   * of {@link Railway.step} for terminal steps: the runtime branch matches
   * the branch `RailwayOutput` picks for `M` (state/phantom invariant), but
   * TS cannot resolve the conditional on an unresolved `M`, hence the cast.
   */
  private out<T>(
    onSync: (result: Result<C, E>) => Result<T, E>,
    onAsync: (result: ResultAsync<C, E>) => ResultAsync<T, E>,
  ): RailwayOutput<T, E, M> {
    return (
      this.state.mode === "sync" ? onSync(this.state.result) : onAsync(this.state.result)
    ) as RailwayOutput<T, E, M>;
  }

  /** Lift the carried result into `ResultAsync` for async-upgrading steps. */
  private toAsync(): ResultAsync<C, E> {
    return this.state.mode === "sync"
      ? ResultAsync.fromResult(this.state.result)
      : this.state.result;
  }

  /** Pure sync derivation. */
  derive<K extends string, T>(key: K, fn: (ctx: C) => T): Railway<C & Record<K, T>, E, M> {
    return this.fromResult(key, (ctx) => ok(fn(ctx)));
  }

  /** Throwing sync transform. */
  fromSync<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => T,
    onThrow: (error: unknown) => F,
  ): Railway<C & Record<K, T>, E | F, M> {
    return this.fromResult(key, (ctx) => trySync(fn, onThrow)(ctx));
  }

  /** Sync `Result`-returning step. */
  fromResult<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => Result<T, F>,
  ): Railway<C & Record<K, T>, E | F, M> {
    return this.step(
      (result) => flatMap(result, (ctx) => map(fn(ctx), (value) => addField(ctx, key, value))),
      (result) =>
        result.flatMap((ctx) =>
          ResultAsync.fromResult(fn(ctx)).map((value) => addField(ctx, key, value)),
        ),
    );
  }

  /** Promise-returning step — upgrades the workflow to async mode. */
  fromPromise<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => PromiseLike<T>,
    onReject: (error: unknown) => F,
  ): Railway<C & Record<K, T>, E | F, "async"> {
    return this.fromAsync(key, (ctx) => ResultAsync.fromPromise(fn(ctx), onReject));
  }

  /** `ResultAsync`-returning step — upgrades the workflow to async mode. */
  fromAsync<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => ResultAsync<T, F>,
  ): Railway<C & Record<K, T>, E | F, "async"> {
    return new Railway({
      mode: "async",
      result: this.toAsync().flatMap((ctx) => fn(ctx).map((value) => addField(ctx, key, value))),
    });
  }

  /** Narrow a nullable context field into a required non-null field. */
  require<K extends string, S extends keyof C, F>(
    key: K,
    source: S,
    onMissing: (ctx: C) => F,
  ): Railway<C & Record<K, NonNullable<C[S]>>, E | F, M> {
    return this.fromResult(key, (ctx) => {
      const value = ctx[source];
      return value == null ? err(onMissing(ctx)) : ok(value);
    });
  }

  /** Run independent `ResultAsync` branches concurrently and merge outputs. */
  parallel<R extends Record<string, BranchFn<C>>>(
    branches: R,
  ): Railway<C & ParallelOutput<R>, E | ParallelError<R>, "async"> {
    const merged = this.toAsync().flatMap((ctx) =>
      ResultAsync.combineTupleParallel(
        Object.entries(branches).map(([, branch]) => branch(ctx)),
      ).map(
        (values) =>
          // Branch outputs land under exactly R's keys; Object.fromEntries
          // erases that correspondence, so reassert the merged shape.
          ({
            ...ctx,
            ...Object.fromEntries(Object.keys(branches).map((key, index) => [key, values[index]])),
          }) as C & ParallelOutput<R>,
      ),
    );
    return new Railway({
      mode: "async",
      // BranchFn erases per-key types to `ResultAsync<unknown, unknown>`
      // (ParallelOutput/ParallelError recover them from R), so re-assert the
      // precise value/error union the branches actually produce.
      result: merged as ResultAsync<C & ParallelOutput<R>, E | ParallelError<R>>,
    });
  }

  /** Project the final context into the workflow's output type. */
  select<T>(fn: (ctx: C) => T): RailwayOutput<T, E, M> {
    return this.out(
      (result) => map(result, fn),
      (result) => result.map(fn),
    );
  }

  /** Return the accumulated context as-is. */
  done(): RailwayOutput<C, E, M> {
    return this.out(
      (result) => result,
      (result) => result,
    );
  }
}
