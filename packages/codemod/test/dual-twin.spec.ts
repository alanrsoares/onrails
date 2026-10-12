/**
 * `dual` is vendored in `@onrails/result` and `@onrails/maybe` (cross-package
 * imports are forbidden), with a "keep in sync" comment as the only guard. The
 * two copies differ textually, so this pins what matters: they dispatch the
 * same way for every arity / argument-count combination. Like the other
 * conformance specs, it loads the sources at test time rather than importing
 * them as package dependencies.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

type Dual = (arity: number, body: (...args: never[]) => unknown) => (...args: unknown[]) => unknown;

const load = async (pkg: string): Promise<Dual> => {
  const mod = (await import(join(import.meta.dir, "../..", pkg, "src/internal/dual.ts"))) as {
    dual: Dual;
  };
  return mod.dual;
};

const [resultDual, maybeDual] = await Promise.all([load("result"), load("maybe")]);

const body = (...args: unknown[]) => ({ args });

// label, arity, call-time argument count
const rows = [
  { label: "arity 2, data-first", arity: 2, argc: 2 },
  { label: "arity 2, curried", arity: 2, argc: 1 },
  { label: "arity 2, over-applied", arity: 2, argc: 3 },
  { label: "arity 3, data-first", arity: 3, argc: 3 },
  { label: "arity 3, one short", arity: 3, argc: 2 },
  { label: "arity 3, curried", arity: 3, argc: 1 },
  { label: "arity 1, zero args", arity: 1, argc: 0 },
];

describe("dual twins (result / maybe)", () => {
  it.each(rows)("dispatch matches: $label", ({ arity, argc }) => {
    const args = Array.from({ length: argc }, (_, i) => `a${i}`);
    const run = (dual: Dual) => {
      const out = dual(arity, body as (...a: never[]) => unknown)(...args);
      // a curried call returns a unary function awaiting `self`
      return typeof out === "function" ? (out as (self: unknown) => unknown)("self") : out;
    };
    expect(run(maybeDual)).toEqual(run(resultDual));
  });

  it("curried form is unary in both", () => {
    const fn = (dual: Dual) => dual(2, body as (...a: never[]) => unknown)("x") as () => unknown;
    expect(fn(maybeDual).length).toBe(fn(resultDual).length);
  });
});
