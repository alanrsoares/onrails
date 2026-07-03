/**
 * Owning module for the dual-form call idiom used across `@onrails/maybe`:
 * a function accepts either data-first (`map(m, fn)`) or curried data-last
 * (`map(fn)(m)`) invocation, dispatching on argument count against a fixed
 * `arity`.
 *
 * This is a deliberate twin of `packages/result/src/internal/dual.ts` — keep
 * the two in sync. No cross-package imports are allowed in this repo, so the
 * helper is vendored independently in each package rather than shared.
 */
export function dual<F>(arity: number, body: (...args: never[]) => unknown): F {
  const dispatch = (...args: unknown[]): unknown => {
    if (args.length >= arity) return (body as (...a: unknown[]) => unknown)(...args);
    return (self: unknown) => (body as (...a: unknown[]) => unknown)(self, ...args);
  };
  // cast: the caller's overloaded type annotation supplies the real signature
  return dispatch as F;
}
