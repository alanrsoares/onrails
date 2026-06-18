import { ResultAsync } from "./async.js";
import { err, isErr, ok, trySync } from "./result.js";
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
 * Initial context shape for a `railway` functional pipeline.
 * Wraps the raw input under the `input` key so subsequent named steps
 * can reference it via `ctx.input`.
 */
export type RailwayInput<I> = { readonly input: I };

type RailwayState<C extends object, E> =
  | { readonly mode: "sync"; readonly result: Result<C, E> }
  | { readonly mode: "async"; readonly result: ResultAsync<C, E> };

export type BranchFn<C extends object> = (ctx: C) => ResultAsync<unknown, unknown>;
export type BranchRecord = Record<string, (ctx: never) => ResultAsync<unknown, unknown>>;
type BranchOk<R> = R extends (ctx: never) => ResultAsync<infer T, infer _E> ? T : never;
type BranchErr<R> = R extends (ctx: never) => ResultAsync<infer _T, infer E> ? E : never;
type BranchInput<R> = R extends (ctx: infer C) => ResultAsync<unknown, unknown> ? C : never;
export type ParallelInput<R extends BranchRecord> = BranchInput<R[keyof R]> & object;
export type ParallelOutput<R extends BranchRecord> = {
  [K in keyof R]: BranchOk<R[K]>;
};
export type ParallelError<R extends BranchRecord> = BranchErr<R[keyof R]>;

const addField = <C extends object, K extends string, T>(
  ctx: C,
  key: K,
  value: T,
): C & Record<K, T> => ({ ...ctx, [key]: value }) as C & Record<K, T>;

const liftResult = <C extends object, E>(result: Result<C, E>): ResultAsync<C, E> =>
  ResultAsync.fromResult(result);

/**
 * Named-context workflow builder. Each step appends a typed field to the
 * accumulating context object; the workflow tracks sync/async mode so the
 * final output type ({@link RailwayOutput}) is correct.
 *
 * Use `Railway` when a service workflow has 4+ named steps, mixed sync and
 * async boundaries, or independent async branches that should run in
 * parallel. For 1–2 step flows, prefer `flatMap` / `asyncAfter` directly.
 *
 * @example
 * ```ts
 * const summary = Railway
 *   .fromSync("id", () => IdSchema.parse(raw), toError)
 *   .fromPromise("row", ({ id }) => db.profiles.findFirst({ where: eq(profiles.id, id) }), toError)
 *   .require("profile", "row", ({ id }) => ({ kind: "not_found" as const, id }))
 *   .derive("normalized", ({ profile }) => normalizeProfile(profile))
 *   .parallel({
 *     artifacts: ({ normalized }) => loadArtifacts(normalized.id),
 *     metrics:   ({ normalized }) => loadMetrics(normalized.id),
 *   })
 *   .select(({ normalized, artifacts, metrics }) =>
 *     toProfileSummary({ profile: normalized, artifacts, metrics }),
 *   );
 * // ResultAsync<ProfileSummary, ParseError | DbError | NotFound>
 * ```
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

  /**
   * Start a sync workflow with a throwing function — `onThrow` maps any
   * exception to a typed error.
   */
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
   * Pure sync derivation — `fn` must not throw. Use {@link fromSync} for
   * throwing transforms.
   */
  derive<K extends string, T>(key: K, fn: (ctx: C) => T): Railway<C & Record<K, T>, E, M> {
    return this.fromResult(key, (ctx) => ok(fn(ctx)));
  }

  /**
   * Throwing sync transform. Adds `{ [key]: T }` to context; converts any
   * exception to `Err<F>` via `onThrow`.
   */
  fromSync<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => T,
    onThrow: (error: unknown) => F,
  ): Railway<C & Record<K, T>, E | F, M> {
    return this.fromResult(key, (ctx) => trySync(fn, onThrow)(ctx));
  }

  /**
   * Sync `Result`-returning step. Adds `{ [key]: T }` to context on `Ok`;
   * short-circuits the workflow on `Err`. Error union widens to `E | F`.
   */
  fromResult<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => Result<T, F>,
  ): Railway<C & Record<K, T>, E | F, M> {
    if (this.state.mode === "sync") {
      const current = this.state.result;
      if (isErr(current)) {
        return new Railway({ mode: "sync", result: err(current.error) });
      }
      const next = fn(current.value);
      return isErr(next)
        ? new Railway({ mode: "sync", result: err(next.error) })
        : new Railway({
            mode: "sync",
            result: ok(addField(current.value, key, next.value)),
          });
    }

    return new Railway({
      mode: "async",
      result: this.state.result.flatMap((ctx) =>
        ResultAsync.fromResult(fn(ctx)).map((value) => addField(ctx, key, value)),
      ),
    }) as Railway<C & Record<K, T>, E | F, M>;
  }

  /**
   * Promise-returning step — upgrades the workflow to async mode. Reject
   * reasons go through `onReject` to become typed `Err<F>`.
   */
  fromPromise<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => PromiseLike<T>,
    onReject: (error: unknown) => F,
  ): Railway<C & Record<K, T>, E | F, "async"> {
    return this.fromAsync(key, (ctx) => ResultAsync.fromPromise(fn(ctx), onReject));
  }

  /**
   * `ResultAsync`-returning step — upgrades the workflow to async mode.
   * Already-typed error: no mapper needed.
   */
  fromAsync<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => ResultAsync<T, F>,
  ): Railway<C & Record<K, T>, E | F, "async"> {
    const current = this.state.mode === "sync" ? liftResult(this.state.result) : this.state.result;

    return new Railway({
      mode: "async",
      result: current.flatMap((ctx) => fn(ctx).map((value) => addField(ctx, key, value))),
    });
  }

  /**
   * Narrow a nullable context field into a required non-null field. If the
   * source field is `null` / `undefined`, the workflow short-circuits with
   * `onMissing(ctx)`.
   *
   * @example
   * ```ts
   * .fromPromise("row", ({ id }) => db.users.findFirst({ where: eq(users.id, id) }))
   * .require("user", "row", ({ id }) => ({ kind: "not_found" as const, id }))
   * // user is now User (non-null), not User | null
   * ```
   */
  require<K extends string, S extends keyof C, F>(
    key: K,
    source: S,
    onMissing: (ctx: C) => F,
  ): Railway<C & Record<K, NonNullable<C[S]>>, E | F, M> {
    return this.fromResult(key, (ctx) => {
      const value = ctx[source];
      return value == null ? err(onMissing(ctx)) : ok(value as NonNullable<C[S]>);
    });
  }

  /**
   * Run independent `ResultAsync` branches concurrently and merge their
   * named outputs back into context. Upgrades the workflow to async mode.
   * On multiple failures, the first `Err` in record-iteration order wins.
   *
   * @example
   * ```ts
   * .parallel({
   *   recent:  ({ userId }) => loadRecent(userId),
   *   metrics: ({ userId }) => loadMetrics(userId),
   * })
   * // ctx now has { ..., recent, metrics }
   * ```
   */
  parallel<R extends Record<string, BranchFn<C>>>(
    branches: R,
  ): Railway<C & ParallelOutput<R>, E | ParallelError<R>, "async"> {
    const current = this.state.mode === "sync" ? liftResult(this.state.result) : this.state.result;

    return new Railway({
      mode: "async",
      result: current.flatMap((ctx) =>
        ResultAsync.combineTupleParallel(
          Object.entries(branches).map(([, branch]) => branch(ctx)),
        ).map((values) => {
          const next = { ...ctx } as C & ParallelOutput<R>;
          Object.keys(branches).forEach((key, index) => {
            (next as Record<string, unknown>)[key] = values[index];
          });
          return next;
        }),
      ),
    }) as Railway<C & ParallelOutput<R>, E | ParallelError<R>, "async">;
  }

  /**
   * Project the final context into the workflow's output type. Hides the
   * internal context shape from callers.
   */
  select<T>(fn: (ctx: C) => T): RailwayOutput<T, E, M> {
    if (this.state.mode === "sync") {
      const current = this.state.result;
      return (isErr(current) ? err(current.error) : ok(fn(current.value))) as RailwayOutput<
        T,
        E,
        M
      >;
    }

    return this.state.result.map(fn) as RailwayOutput<T, E, M>;
  }

  /**
   * Return the accumulated context as-is. Use when downstream code needs
   * every named field; prefer {@link select} when you can project to a DTO.
   */
  done(): RailwayOutput<C, E, M> {
    return this.state.result as RailwayOutput<C, E, M>;
  }
}
