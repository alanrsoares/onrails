import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

/**
 * Carrier-agnostic view of a `C<number, string>`-shaped type. `settle` is the
 * async seam: sync carriers return themselves, thenables resolve to a plain
 * value, so `await settle(c)` compares every carrier the same way.
 */
export type LawsAdapter<C> = {
  readonly label: string;
  readonly arb: fc.Arbitrary<C>;
  readonly of: (n: number) => C;
  readonly map: (c: C, fn: (n: number) => number) => C;
  readonly flatMap: (c: C, fn: (n: number) => C) => C;
  readonly mapErr: (c: C, fn: (s: string) => string) => C;
  readonly settle: (c: C) => unknown;
};

type Fns = {
  readonly arbFn: fc.Arbitrary<(n: number) => number>;
  readonly arbErrFn: fc.Arbitrary<(s: string) => string>;
};

const identity = <A>(a: A): A => a;

/** Suite A (functor + monad) and suite E (error-channel functor). */
export const monadLaws = <C>(adapter: LawsAdapter<C>, { arbFn, arbErrFn }: Fns): void => {
  const { arb, label, of, map, flatMap, mapErr, settle } = adapter;
  const arbKleisli = fc.func(arb).map((f) => (n: number) => f(n));
  const same = async (a: C, b: C): Promise<void> => {
    expect(await settle(a)).toEqual(await settle(b));
  };

  describe(`${label} laws`, () => {
    it("functor identity: map(c, id) equals c", async () => {
      await fc.assert(fc.asyncProperty(arb, (c) => same(map(c, identity), c)));
    });

    it("functor composition: map(map(c, f), g) equals map(c, g . f)", async () => {
      await fc.assert(
        fc.asyncProperty(arb, arbFn, arbFn, (c, f, g) =>
          same(
            map(map(c, f), g),
            map(c, (n) => g(f(n))),
          ),
        ),
      );
    });

    it("monad left identity: flatMap(of(a), f) equals f(a)", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer(), arbKleisli, (a, f) => same(flatMap(of(a), f), f(a))),
      );
    });

    it("monad right identity: flatMap(c, of) equals c", async () => {
      await fc.assert(fc.asyncProperty(arb, (c) => same(flatMap(c, of), c)));
    });

    it("monad associativity: flatMap(flatMap(c, f), g) equals flatMap(c, a => flatMap(f(a), g))", async () => {
      await fc.assert(
        fc.asyncProperty(arb, arbKleisli, arbKleisli, (c, f, g) =>
          same(
            flatMap(flatMap(c, f), g),
            flatMap(c, (a) => flatMap(f(a), g)),
          ),
        ),
      );
    });

    it("error functor identity: mapErr(c, id) equals c", async () => {
      await fc.assert(fc.asyncProperty(arb, (c) => same(mapErr(c, identity), c)));
    });

    it("error functor composition: mapErr(mapErr(c, f), g) equals mapErr(c, g . f)", async () => {
      await fc.assert(
        fc.asyncProperty(arb, arbErrFn, arbErrFn, (c, f, g) =>
          same(
            mapErr(mapErr(c, f), g),
            mapErr(c, (s) => g(f(s))),
          ),
        ),
      );
    });
  });
};

/** Suite C: settled value survives JSON and structured-clone round-trips. */
export const serializationLaws = <C>({ label, arb, settle }: LawsAdapter<C>): void => {
  describe(`${label} serialization`, () => {
    it("JSON round-trip preserves the settled value", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (c) => {
          const settled = await settle(c);
          expect(JSON.parse(JSON.stringify(settled))).toEqual(settled);
        }),
      );
    });

    it("structuredClone preserves the settled value", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (c) => {
          const settled = await settle(c);
          expect(structuredClone(settled)).toEqual(settled);
        }),
      );
    });
  });
};
