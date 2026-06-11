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
 * Initial context shape for a {@link railway} functional pipeline.
 * Wraps the raw input under the `input` key so subsequent named steps
 * can reference it via `ctx.input`.
 */
export type RailwayInput<I> = { readonly input: I };

type RailwayState<C extends object, E> =
  | { readonly mode: "sync"; readonly result: Result<C, E> }
  | { readonly mode: "async"; readonly result: ResultAsync<C, E> };

type BranchFn<C extends object> = (ctx: C) => ResultAsync<unknown, unknown>;
type BranchRecord = Record<string, (ctx: never) => ResultAsync<unknown, unknown>>;
type BranchOk<R> = R extends (ctx: never) => ResultAsync<infer T, infer _E> ? T : never;
type BranchErr<R> = R extends (ctx: never) => ResultAsync<infer _T, infer E> ? E : never;
type BranchInput<R> = R extends (ctx: infer C) => ResultAsync<unknown, unknown> ? C : never;
type ParallelInput<R extends BranchRecord> = BranchInput<R[keyof R]> & object;
type ParallelOutput<R extends BranchRecord> = {
  [K in keyof R]: BranchOk<R[K]>;
};
type ParallelError<R extends BranchRecord> = BranchErr<R[keyof R]>;
type ParserLike<I, T> = { readonly parse: (input: I) => T } | ((input: I) => T);
type UnaryStep<I, O> = (input: I) => O;

const addField = <C extends object, K extends string, T>(
  ctx: C,
  key: K,
  value: T,
): C & Record<K, T> => ({ ...ctx, [key]: value }) as C & Record<K, T>;

const liftResult = <C extends object, E>(result: Result<C, E>): ResultAsync<C, E> =>
  ResultAsync.fromResult(result);

const parseWithParser = <I, T>(parser: ParserLike<I, T>, input: I): T =>
  typeof parser === "function" ? parser(input) : parser.parse(input);

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
      if (isErr(next)) {
        return new Railway({ mode: "sync", result: err(next.error) });
      }
      return new Railway({
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

/**
 * Functional companion to {@link Railway} — point-free composition of
 * reusable workflow steps. Starts from `Railway.context({ input })` and
 * applies each step in order. Step factories live below: {@link parseWith},
 * {@link fromSyncNamed}, {@link fromResultNamed}, {@link fromPromiseNamed},
 * {@link fromAsyncNamed}, {@link deriveNamed}, {@link requireNamed},
 * {@link parallelNamed}, {@link select}.
 *
 * @example
 * ```ts
 * const summary = railway(
 *   rawId,
 *   parseWith(IdSchema, toError).as("id"),
 *   fromPromiseNamed("row", ({ id }) => db.profiles.findFirst({ where: eq(profiles.id, id) }), toError),
 *   requireNamed("profile", "row", ({ id }) => ({ kind: "not_found" as const, id })),
 *   deriveNamed("normalized", ({ profile }) => normalizeProfile(profile)),
 *   select(({ normalized }) => toProfileSummary(normalized)),
 * );
 * ```
 */
export function railway<I, A>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
): A;
export function railway<I, A, B>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
): B;
export function railway<I, A, B, C>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
): C;
export function railway<I, A, B, C, D>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
  step4: UnaryStep<C, D>,
): D;
export function railway<I, A, B, C, D, E>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
  step4: UnaryStep<C, D>,
  step5: UnaryStep<D, E>,
): E;
export function railway<I, A, B, C, D, E, F>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
  step4: UnaryStep<C, D>,
  step5: UnaryStep<D, E>,
  step6: UnaryStep<E, F>,
): F;
export function railway<I, A, B, C, D, E, F, G>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
  step4: UnaryStep<C, D>,
  step5: UnaryStep<D, E>,
  step6: UnaryStep<E, F>,
  step7: UnaryStep<F, G>,
): G;
export function railway<I, A, B, C, D, E, F, G, H>(
  input: I,
  step1: UnaryStep<Railway<RailwayInput<I>, never, "sync">, A>,
  step2: UnaryStep<A, B>,
  step3: UnaryStep<B, C>,
  step4: UnaryStep<C, D>,
  step5: UnaryStep<D, E>,
  step6: UnaryStep<E, F>,
  step7: UnaryStep<F, G>,
  step8: UnaryStep<G, H>,
): H;
export function railway<I>(input: I, ...steps: readonly ((input: never) => unknown)[]): unknown {
  return steps.reduce<unknown>(
    (current, step) => (step as (input: unknown) => unknown)(current),
    Railway.context({ input }),
  );
}

/**
 * Step factory: parse the workflow input with a Zod-like schema (or a
 * unary parse function). Call `.as(key)` to name the output field.
 *
 * @example
 * ```ts
 * parseWith(IdSchema, toError).as("id");
 * // Used as the first step in `railway(rawId, parseId, ...)`
 * ```
 */
export const parseWith = <I, T, E>(parser: ParserLike<I, T>, onThrow: (error: unknown) => E) => ({
  as:
    <K extends string>(key: K) =>
    <F, M extends RailwayMode>(
      workflow: Railway<RailwayInput<I>, F, M>,
    ): Railway<RailwayInput<I> & Record<K, T>, F | E, M> =>
      workflow.fromSync(key, ({ input }) => parseWithParser(parser, input), onThrow),
});

/**
 * Reusable wrapper around {@link Railway.fromSync}. Captures key + fn +
 * onThrow once; applies to any compatible workflow.
 */
export const fromSyncNamed =
  <K extends string, C extends object, T, E>(
    key: K,
    fn: (ctx: C) => T,
    onThrow: (error: unknown) => E,
  ) =>
  <I extends C, F, M extends RailwayMode>(
    workflow: Railway<I, F, M>,
  ): Railway<I & Record<K, T>, F | E, M> =>
    workflow.fromSync(key, fn, onThrow);

/** Reusable wrapper around {@link Railway.fromResult}. */
export const fromResultNamed =
  <K extends string, C extends object, T, E>(key: K, fn: (ctx: C) => Result<T, E>) =>
  <I extends C, F, M extends RailwayMode>(
    workflow: Railway<I, F, M>,
  ): Railway<I & Record<K, T>, F | E, M> =>
    workflow.fromResult(key, fn);

/**
 * Reusable wrapper around {@link Railway.fromPromise}. Upgrades the
 * workflow to async mode when applied.
 */
export const fromPromiseNamed =
  <K extends string, C extends object, T, E>(
    key: K,
    fn: (ctx: C) => PromiseLike<T>,
    onReject: (error: unknown) => E,
  ) =>
  <I extends C, F, M extends RailwayMode>(
    workflow: Railway<I, F, M>,
  ): Railway<I & Record<K, T>, F | E, "async"> =>
    workflow.fromPromise(key, fn, onReject);

/** Reusable wrapper around {@link Railway.fromAsync}. */
export const fromAsyncNamed =
  <K extends string, C extends object, T, E>(key: K, fn: (ctx: C) => ResultAsync<T, E>) =>
  <I extends C, F, M extends RailwayMode>(
    workflow: Railway<I, F, M>,
  ): Railway<I & Record<K, T>, F | E, "async"> =>
    workflow.fromAsync(key, fn);

/** Reusable wrapper around {@link Railway.derive} — pure sync derivation. */
export const deriveNamed =
  <K extends string, C extends object, T>(key: K, fn: (ctx: C) => T) =>
  <I extends C, E, M extends RailwayMode>(
    workflow: Railway<I, E, M>,
  ): Railway<I & Record<K, T>, E, M> =>
    workflow.derive(key, fn);

/** Reusable wrapper around {@link Railway.require} — narrows a nullable field. */
export const requireNamed =
  <K extends string, S extends string, C extends object, E>(
    key: K,
    source: S,
    onMissing: (ctx: C & Record<S, unknown>) => E,
  ) =>
  <I extends C & Record<S, unknown>, F, M extends RailwayMode>(
    workflow: Railway<I, F, M>,
  ): Railway<I & Record<K, NonNullable<I[S]>>, F | E, M> =>
    workflow.require(key, source, onMissing);

/**
 * Reusable wrapper around {@link Railway.parallel}. Branches run
 * concurrently and merge their named outputs back into context.
 */
export const parallelNamed =
  <R extends BranchRecord>(branches: R) =>
  <I extends ParallelInput<R>, E, M extends RailwayMode>(
    workflow: Railway<I, E, M>,
  ): Railway<I & ParallelOutput<R>, E | ParallelError<R>, "async"> => {
    // TS cannot prove contravariant branch params after storing reusable steps.
    const typedBranches = branches as unknown as Record<string, BranchFn<I>>;
    return workflow.parallel(typedBranches) as unknown as Railway<
      I & ParallelOutput<R>,
      E | ParallelError<R>,
      "async"
    >;
  };

/**
 * Reusable wrapper around {@link Railway.select} — projects the final
 * context into the workflow's output type.
 */
export const select =
  <C extends object, T>(fn: (ctx: C) => T) =>
  <E, M extends RailwayMode>(workflow: Railway<C, E, M>): RailwayOutput<T, E, M> =>
    workflow.select(fn);
