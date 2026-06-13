import type { ResultAsync } from "./async.js";
import type {
  BranchFn,
  BranchRecord,
  ParallelError,
  ParallelInput,
  ParallelOutput,
  RailwayInput,
  RailwayMode,
  RailwayOutput,
} from "./railway-core.js";
import { Railway } from "./railway-core.js";
import type { Result } from "./types.js";

type ParserLike<I, T> = { readonly parse: (input: I) => T } | ((input: I) => T);
type UnaryStep<I, O> = (input: I) => O;

const parseWithParser = <I, T>(parser: ParserLike<I, T>, input: I): T =>
  typeof parser === "function" ? parser(input) : parser.parse(input);

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
 * Name-first companion to {@link parseWith}: parse the workflow input with a
 * Zod-like schema (or unary parse fn), naming the output field in the same
 * `(key, ...)` shape as {@link fromSyncNamed}, {@link deriveNamed}, et al.
 * Prefer this in `railway(...)` pipelines so every step's name aligns at the
 * left edge.
 *
 * @example
 * ```ts
 * railway(
 *   rawId,
 *   parseNamed("id", IdSchema, toError),
 *   fromPromiseNamed("profile", ({ id }) => fetchProfile(id), toError),
 * );
 * ```
 */
export const parseNamed =
  <K extends string, I, T, E>(key: K, parser: ParserLike<I, T>, onThrow: (error: unknown) => E) =>
  <F, M extends RailwayMode>(
    workflow: Railway<RailwayInput<I>, F, M>,
  ): Railway<RailwayInput<I> & Record<K, T>, F | E, M> =>
    workflow.fromSync(key, ({ input }) => parseWithParser(parser, input), onThrow);

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
