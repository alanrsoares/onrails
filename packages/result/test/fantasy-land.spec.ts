import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { bimap, err, flatMap, map, ok } from "../src/result.js";
import type { Result } from "../src/types.js";

const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

const arbIntFn = (): fc.Arbitrary<(n: number) => number> =>
  fc.func(fc.integer()) as fc.Arbitrary<(n: number) => number>;

const arbStrFn = (): fc.Arbitrary<(s: string) => string> =>
  fc.func(fc.string()) as fc.Arbitrary<(s: string) => string>;

const arbResultFn = (): fc.Arbitrary<(n: number) => Result<number, string>> =>
  fc.func(arbResult) as fc.Arbitrary<(n: number) => Result<number, string>>;

describe("Fantasy Land laws (sync, property-based)", () => {
  it("functor identity: map(id)(r) === r", () => {
    fc.assert(
      fc.property(arbResult, (r) => {
        expect(map((x: number) => x)(r)).toEqual(r);
      }),
    );
  });

  it("functor composition: map(g)(map(f)(r)) === map(x => g(f(x)))(r)", () => {
    fc.assert(
      fc.property(arbResult, arbIntFn(), arbIntFn(), (r, f, g) => {
        expect(map(g)(map(f)(r))).toEqual(map((x: number) => g(f(x)))(r));
      }),
    );
  });

  it("monad left identity: flatMap(f)(ok(a)) === f(a)", () => {
    fc.assert(
      fc.property(fc.integer(), arbResultFn(), (a, f) => {
        expect(flatMap(f)(ok<number, string>(a))).toEqual(f(a));
      }),
    );
  });

  it("monad right identity: flatMap(ok)(m) === m", () => {
    fc.assert(
      fc.property(arbResult, (m) => {
        expect(flatMap((x: number) => ok<number, string>(x))(m)).toEqual(m);
      }),
    );
  });

  it("monad associativity: flatMap(g)(flatMap(f)(m)) === flatMap(x => flatMap(g)(f(x)))(m)", () => {
    fc.assert(
      fc.property(arbResult, arbResultFn(), arbResultFn(), (m, f, g) => {
        const lhs = flatMap(g)(flatMap(f)(m));
        const rhs = flatMap((x: number) => flatMap(g)(f(x)))(m);
        expect(lhs).toEqual(rhs);
      }),
    );
  });

  it("Err is left zero: flatMap(f)(err(e)) === err(e)", () => {
    fc.assert(
      fc.property(fc.string(), arbResultFn(), (e, f) => {
        expect(flatMap(f)(err<number, string>(e))).toEqual(err<number, string>(e));
      }),
    );
  });
});

describe("Bifunctor laws (bimap, property-based)", () => {
  it("identity: bimap(id, id)(r) === r", () => {
    fc.assert(
      fc.property(arbResult, (r) => {
        expect(
          bimap(
            (x: number) => x,
            (e: string) => e,
          )(r),
        ).toEqual(r);
      }),
    );
  });

  it("composition: bimap(f1∘f2, g1∘g2) === bimap(f1, g1) ∘ bimap(f2, g2)", () => {
    fc.assert(
      fc.property(
        arbResult,
        arbIntFn(),
        arbIntFn(),
        arbStrFn(),
        arbStrFn(),
        (r, f1, f2, g1, g2) => {
          const lhs = bimap(
            (x: number) => f1(f2(x)),
            (e: string) => g1(g2(e)),
          )(r);
          const rhs = bimap(f1, g1)(bimap(f2, g2)(r));
          expect(lhs).toEqual(rhs);
        },
      ),
    );
  });
});
