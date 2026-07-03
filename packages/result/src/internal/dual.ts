/**
 * @onrails/result internal — owning module for the **dual-form idiom**.
 *
 * Every dual-form transform in this package (`map`, `flatMap`, `match`, …)
 * accepts either shape:
 *
 *   data-first: `map(result, fn)`  — full arity, runs immediately
 *   curried:    `map(fn)(result)`  — arity minus the leading `self`, returns
 *                                    a unary function awaiting the data
 *
 * {@link dual} is the single arity dispatcher those transforms derive from;
 * hand-rolled `args.length` checks are not allowed elsewhere.
 *
 * NOTE: a twin copy of this module lives at `packages/maybe/src/internal/dual.ts`
 * — keep the two in sync when editing.
 *
 * Internal only: not listed in package.json `exports` or tsup entries.
 */

/**
 * Derive a dual-form (data-first / curried) function from a single
 * data-first `body`.
 *
 * When called with `args.length >= arity` the wrapper runs `body(...args)`
 * (data-first). With fewer arguments it returns `(self) => body(self, ...args)`
 * — the curried, data-last-`self` form used with `pipe`/`flow`.
 *
 * The public type is supplied entirely by the caller: annotate the exported
 * const with the exact overload set and let `F` be inferred from it.
 *
 * @example
 * ```ts
 * export const map: {
 *   <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
 *   <T, U>(fn: (value: T) => U): <E>(result: Result<T, E>) => Result<U, E>;
 * } = dual(
 *   2,
 *   <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
 *     isOk(result) ? ok(fn(result.value)) : err(result.error),
 * );
 * ```
 */
export const dual = <F>(arity: number, body: (...args: never[]) => unknown): F => {
  // `(...args: never[]) => unknown` is the top function type, so every typed
  // body is assignable to the parameter — but it cannot be invoked with
  // `unknown` arguments. Re-view it through the variadic shape the dispatcher
  // actually forwards; the constraint is that `body` only ever receives the
  // arguments the caller's overload annotation admitted.
  const run = body as (...args: readonly unknown[]) => unknown;
  const dispatcher = (...args: readonly unknown[]): unknown =>
    args.length >= arity ? run(...args) : (self: unknown) => run(self, ...args);
  // The caller's overload annotation on the exported const supplies the real
  // public type; internally the dispatcher stays `unknown`-typed.
  return dispatcher as F;
};
