import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { err, flatMap, map, of, ok } from "../src/result.js";
import type { Result } from "../src/types.js";

const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

const arbIntFn = (): fc.Arbitrary<(n: number) => number> =>
  fc.func(fc.integer()) as fc.Arbitrary<(n: number) => number>;

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

  it("monad left identity: flatMap(f)(of(a)) === f(a)", () => {
    fc.assert(
      fc.property(fc.integer(), arbResultFn(), (a, f) => {
        expect(flatMap(f)(of<number, string>(a))).toEqual(f(a));
      }),
    );
  });

  it("monad right identity: flatMap(of)(m) === m", () => {
    fc.assert(
      fc.property(arbResult, (m) => {
        expect(flatMap((x: number) => of<number, string>(x))(m)).toEqual(m);
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
