import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";

// Maybe-side copy of the carrier-agnostic helper in packages/result/test/helpers/laws.ts
// (cross-package test imports are not allowed). Maybe has no error channel, so no mapErr laws.
export type LawsAdapter<C> = {
  readonly label: string;
  readonly arb: fc.Arbitrary<C>;
  readonly of: (n: number) => C;
  readonly map: (c: C, fn: (n: number) => number) => C;
  readonly flatMap: (c: C, fn: (n: number) => C) => C;
  readonly settle: (c: C) => unknown;
};

const identity = <A>(a: A): A => a;

export const monadLaws = <C>(
  { arb, label, of, map, flatMap, settle }: LawsAdapter<C>,
  arbFn: fc.Arbitrary<(n: number) => number>,
): void => {
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
  });

  describe(`${label} serialization`, () => {
    it("JSON round-trip preserves the value", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (c) => {
          const settled = await settle(c);
          expect(JSON.parse(JSON.stringify(settled))).toEqual(settled);
        }),
      );
    });

    it("structuredClone preserves the value", async () => {
      await fc.assert(
        fc.asyncProperty(arb, async (c) => {
          const settled = await settle(c);
          expect(structuredClone(settled)).toEqual(settled);
        }),
      );
    });
  });
};
