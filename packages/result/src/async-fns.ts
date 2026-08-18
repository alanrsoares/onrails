/**
 * `@onrails/result/async` — data-last twins of the {@link ResultAsync} methods,
 * so an async railway composes with `pipe` / `flow` the same way a sync one does.
 *
 * `ResultAsync` is a class, so dot-chaining is always available and remains the
 * shortest form for a one-off chain. Reach for this module when you want the
 * sync side's other two syntaxes on the async carrier:
 *
 * ```ts
 * import * as RA from "@onrails/result/async";
 * import { pipe } from "@onrails/result";
 * import { flow } from "@onrails/result/pipe";
 *
 * // value-first pipe
 * pipe(loadUser(id), RA.flatMap(loadOrders), RA.map((os) => os.length));
 *
 * // reusable point-free pipeline — no value yet
 * const orderCount = flow(loadUser, RA.flatMap(loadOrders), RA.map((os) => os.length));
 * ```
 *
 * Every export mirrors one `ResultAsync` method exactly, in both forms:
 * data-first (`RA.map(ra, fn)`) and curried (`RA.map(fn)`). Import as a
 * namespace — the names deliberately match the sync core, and `test/parity.spec.ts`
 * enforces that the mirror stays complete.
 */

import type { ResultAsync } from "./async.js";
import { dual } from "./internal/dual.js";
import type { Result } from "./types.js";

/** A step may hand back either carrier; the async one absorbs a sync `Result`. */
type Step<U, F> = ResultAsync<U, F> | Result<U, F>;

/**
 * Transforms the `Ok` value, passing `Err` through unchanged.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), map((u) => u.name));   // ResultAsync<string, LoadError>
 * ```
 */
export const map: {
  <T, U, E>(ra: ResultAsync<T, E>, fn: (value: T) => U): ResultAsync<U, E>;
  <T, U>(fn: (value: T) => U): <E>(ra: ResultAsync<T, E>) => ResultAsync<U, E>;
} = dual(2, <T, U, E>(ra: ResultAsync<T, E>, fn: (value: T) => U): ResultAsync<U, E> => ra.map(fn));

/**
 * Transforms the `Err` value, passing `Ok` through unchanged — useful for
 * unifying heterogeneous failures into one app-level union.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), mapErr((e): AppError => ({ kind: "load", cause: e })));
 * ```
 */
export const mapErr: {
  <T, E, F>(ra: ResultAsync<T, E>, fn: (error: E) => F): ResultAsync<T, F>;
  <E, F>(fn: (error: E) => F): <T>(ra: ResultAsync<T, E>) => ResultAsync<T, F>;
} = dual(
  2,
  <T, E, F>(ra: ResultAsync<T, E>, fn: (error: E) => F): ResultAsync<T, F> => ra.mapErr(fn),
);

/**
 * Transforms both tracks in one step. Exactly one of `onOk` / `onErr` runs.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), bimap(toDto, (e): AppError => ({ kind: "load", cause: e })));
 * ```
 */
export const bimap: {
  <T, U, E, F>(
    ra: ResultAsync<T, E>,
    onOk: (value: T) => U,
    onErr: (error: E) => F,
  ): ResultAsync<U, F>;
  <T, U, E, F>(
    onOk: (value: T) => U,
    onErr: (error: E) => F,
  ): (ra: ResultAsync<T, E>) => ResultAsync<U, F>;
} = dual(
  3,
  <T, U, E, F>(
    ra: ResultAsync<T, E>,
    onOk: (value: T) => U,
    onErr: (error: E) => F,
  ): ResultAsync<U, F> => ra.bimap(onOk, onErr),
);

/**
 * Canonical bind — chains a step returning a `ResultAsync` or a sync `Result`,
 * short-circuiting on `Err`. Error types accumulate (`E | F`).
 *
 * @example
 * ```ts
 * pipe(authenticate(req), flatMap((user) => loadProfile(user.id)));
 * ```
 */
export const flatMap: {
  <T, U, E, F>(ra: ResultAsync<T, E>, fn: (value: T) => Step<U, F>): ResultAsync<U, E | F>;
  <T, U, F>(fn: (value: T) => Step<U, F>): <E>(ra: ResultAsync<T, E>) => ResultAsync<U, E | F>;
} = dual(
  2,
  <T, U, E, F>(ra: ResultAsync<T, E>, fn: (value: T) => Step<U, F>): ResultAsync<U, E | F> =>
    ra.flatMap(fn),
);

/**
 * Error-track bind — runs `fn` only on `Err`, letting a failed workflow
 * recover to `Ok` or remap the failure.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), recover((e) => (e === "notFound" ? okAsync(guest) : errAsync(e))));
 * ```
 */
export const recover: {
  <T, E, F>(ra: ResultAsync<T, E>, fn: (error: E) => Step<T, F>): ResultAsync<T, F>;
  <T, E, F>(fn: (error: E) => Step<T, F>): (ra: ResultAsync<T, E>) => ResultAsync<T, F>;
} = dual(
  2,
  <T, E, F>(ra: ResultAsync<T, E>, fn: (error: E) => Step<T, F>): ResultAsync<T, F> =>
    ra.recover(fn),
);

/**
 * Observes the `Ok` value for side effects without changing it.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), tap((u) => log.info({ msg: "loaded", id: u.id })));
 * ```
 */
export const tap: {
  <T, E>(ra: ResultAsync<T, E>, fn: (value: T) => void): ResultAsync<T, E>;
  <T>(fn: (value: T) => void): <E>(ra: ResultAsync<T, E>) => ResultAsync<T, E>;
} = dual(2, <T, E>(ra: ResultAsync<T, E>, fn: (value: T) => void): ResultAsync<T, E> => ra.tap(fn));

/**
 * Observes the `Err` value for side effects without changing it.
 *
 * @example
 * ```ts
 * pipe(loadUser(id), tapErr((e) => metrics.inc("user.load.fail", { kind: e.kind })));
 * ```
 */
export const tapErr: {
  <T, E>(ra: ResultAsync<T, E>, fn: (error: E) => void): ResultAsync<T, E>;
  <E>(fn: (error: E) => void): <T>(ra: ResultAsync<T, E>) => ResultAsync<T, E>;
} = dual(
  2,
  <T, E>(ra: ResultAsync<T, E>, fn: (error: E) => void): ResultAsync<T, E> => ra.tapErr(fn),
);

/**
 * Terminal collapse — folds both tracks into a single awaited value, settling
 * the carrier exactly once. Ends the pipeline, so it returns a plain `Promise`.
 *
 * @example
 * ```ts
 * const status = await pipe(save(row), match(() => 200, (e) => (e.kind === "conflict" ? 409 : 500)));
 * ```
 */
export const match: {
  <T, E, U1, U2 = U1>(
    ra: ResultAsync<T, E>,
    onOk: (value: T) => U1,
    onErr: (error: E) => U2,
  ): Promise<U1 | U2>;
  <T, E, U1, U2 = U1>(
    onOk: (value: T) => U1,
    onErr: (error: E) => U2,
  ): (ra: ResultAsync<T, E>) => Promise<U1 | U2>;
} = dual(
  3,
  <T, E, U1, U2>(
    ra: ResultAsync<T, E>,
    onOk: (value: T) => U1,
    onErr: (error: E) => U2,
  ): Promise<U1 | U2> => ra.match(onOk, onErr),
);

/**
 * Terminal — resolves to the `Ok` value, or `defaultValue` on `Err`. The
 * fallback may differ from `T`; the result widens to `T | U`.
 *
 * @example
 * ```ts
 * const profile = await pipe(loadProfile(id), unwrapOr(guestProfile));
 * ```
 */
export const unwrapOr: {
  <T, E, U>(ra: ResultAsync<T, E>, defaultValue: U): Promise<T | U>;
  <U>(defaultValue: U): <T, E>(ra: ResultAsync<T, E>) => Promise<T | U>;
} = dual(
  2,
  <T, E, U>(ra: ResultAsync<T, E>, defaultValue: U): Promise<T | U> => ra.unwrapOr(defaultValue),
);
