/**
 * @onrails/result — sequential async traversal that keeps going on `Err`.
 *
 * {@link traverseSeq} and {@link foldSeq} start each step only after the step
 * before it has settled, and collect failed steps instead of stopping. They
 * take sync or async iterables, so paginated APIs and streams need no extra
 * carrier.
 *
 * Both start at the call, like `tryAsync`. A step must not throw: wrap a
 * throwing call in `tryAsync` / `trySync`. A throw is a defect and rejects
 * `resolve()`.
 */

import type { ResultAsync } from "./async.js";
import { fromSafePromise } from "./async-lift.js";
import { dual } from "./internal/dual.js";
import { isErr } from "./result.js";
import type { Result } from "./types.js";

/** A step may hand back either carrier. */
type Step<U, F> = ResultAsync<U, F> | Result<U, F>;

/** A sync or async source of items. */
export type SeqSource<A> = Iterable<A> | AsyncIterable<A>;

/** One failed step: the item it ran on and the `Err` it returned. */
export type SeqFailure<A, E> = { readonly item: A; readonly error: E };

/** Output of {@link traverseSeq}: `Ok` values and failed steps, both in input order. */
export type TraverseSeqOutput<T, A, E> = {
  readonly ok: readonly T[];
  readonly failed: readonly SeqFailure<A, E>[];
};

/** Output of {@link foldSeq}: the final state and the failed steps, in input order. */
export type FoldSeqOutput<S, A, E> = {
  readonly state: S;
  readonly failed: readonly SeqFailure<A, E>[];
};

/**
 * Visits every item in turn. A sync iterable goes through `for...of`, not
 * `for await`, so items that are themselves thenables are not unwrapped.
 */
const inTurn = async <A>(
  source: SeqSource<A>,
  visit: (item: A) => Promise<void>,
): Promise<void> => {
  if (typeof (source as Partial<AsyncIterable<A>>)[Symbol.asyncIterator] === "function") {
    for await (const item of source as AsyncIterable<A>) await visit(item);
    return;
  }
  for (const item of source as Iterable<A>) await visit(item);
};

const traverseSeqImpl = <A, T, E>(
  items: SeqSource<A>,
  fn: (item: A) => Step<T, E>,
): ResultAsync<TraverseSeqOutput<T, A, E>, never> => {
  const ok: T[] = [];
  const failed: SeqFailure<A, E>[] = [];
  const run = inTurn(items, async (item) => {
    const result = await fn(item);
    if (isErr(result)) failed.push({ item, error: result.error });
    else ok.push(result.value);
  });
  return fromSafePromise(run.then(() => ({ ok, failed })));
};

/**
 * Runs `fn` on each item, one at a time, and collects the results. A step
 * starts only after the one before it has settled. A failed step is recorded
 * in `failed` and the traversal goes on; the carrier itself never fails.
 *
 * @example
 * ```ts
 * // Move each object in turn (two at once collide); report the refused ids.
 * const moved = traverseSeq(ids, (id) => changeState(id));
 * // ResultAsync<{ ok: readonly State[]; failed: readonly { item: number; error: StateError }[] }, never>
 * ```
 */
export const traverseSeq: {
  <A, T, E>(
    items: SeqSource<A>,
    fn: (item: A) => Step<T, E>,
  ): ResultAsync<TraverseSeqOutput<T, A, E>, never>;
  <A, T, E>(
    fn: (item: A) => Step<T, E>,
  ): (items: SeqSource<A>) => ResultAsync<TraverseSeqOutput<T, A, E>, never>;
} = dual(2, traverseSeqImpl);

const foldSeqImpl = <A, S, E>(
  items: SeqSource<A>,
  init: S,
  fn: (state: S, item: A) => Step<S, E>,
): ResultAsync<FoldSeqOutput<S, A, E>, never> => {
  let state = init;
  const failed: SeqFailure<A, E>[] = [];
  const run = inTurn(items, async (item) => {
    const result = await fn(state, item);
    if (isErr(result)) failed.push({ item, error: result.error });
    else state = result.value;
  });
  return fromSafePromise(run.then(() => ({ state, failed })));
};

/**
 * Threads a state through the items, one step at a time. Each step reads the
 * state the step before it produced. A failed step is recorded in `failed`
 * and leaves the state as it was.
 *
 * @example
 * ```ts
 * // Add each topic after the last one that was added; count the misses.
 * const added = foldSeq(topicIds, null as Anchor | null, (after, id) =>
 *   addTopic(bookId, id, after).map(() => ({ id })),
 * );
 * // ResultAsync<{ state: Anchor | null; failed: readonly { item: string; error: AddError }[] }, never>
 * ```
 */
export const foldSeq: {
  <A, S, E>(
    items: SeqSource<A>,
    init: S,
    fn: (state: S, item: A) => Step<S, E>,
  ): ResultAsync<FoldSeqOutput<S, A, E>, never>;
  <A, S, E>(
    init: S,
    fn: (state: S, item: A) => Step<S, E>,
  ): (items: SeqSource<A>) => ResultAsync<FoldSeqOutput<S, A, E>, never>;
} = dual(3, foldSeqImpl);
