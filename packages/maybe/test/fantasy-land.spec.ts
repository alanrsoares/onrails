import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { flatMap, map, none, some } from "../src/maybe.js";
import type { Maybe } from "../src/types.js";

const arbMaybe: fc.Arbitrary<Maybe<number>> = fc.oneof(
  fc.integer().map((n) => some(n)),
  fc.constant(none<number>()),
);

const arbIntFn = (): fc.Arbitrary<(n: number) => number> =>
  fc.func(fc.integer()) as fc.Arbitrary<(n: number) => number>;

const arbMaybeFn = (): fc.Arbitrary<(n: number) => Maybe<number>> =>
  fc.func(arbMaybe) as fc.Arbitrary<(n: number) => Maybe<number>>;

describe("Fantasy Land laws (Maybe, property-based)", () => {
  it("functor identity: map(id)(m) === m", () => {
    fc.assert(
      fc.property(arbMaybe, (m) => {
        expect(map((x: number) => x)(m)).toEqual(m);
      }),
    );
  });

  it("functor composition: map(g)(map(f)(m)) === map(x => g(f(x)))(m)", () => {
    fc.assert(
      fc.property(arbMaybe, arbIntFn(), arbIntFn(), (m, f, g) => {
        expect(map(g)(map(f)(m))).toEqual(map((x: number) => g(f(x)))(m));
      }),
    );
  });

  it("monad left identity: flatMap(f)(some(a)) === f(a)", () => {
    fc.assert(
      fc.property(fc.integer(), arbMaybeFn(), (a, f) => {
        expect(flatMap(f)(some(a))).toEqual(f(a));
      }),
    );
  });

  it("monad right identity: flatMap(some)(m) === m", () => {
    fc.assert(
      fc.property(arbMaybe, (m) => {
        expect(flatMap((x: number) => some(x))(m)).toEqual(m);
      }),
    );
  });

  it("monad associativity: flatMap(g)(flatMap(f)(m)) === flatMap(x => flatMap(g)(f(x)))(m)", () => {
    fc.assert(
      fc.property(arbMaybe, arbMaybeFn(), arbMaybeFn(), (m, f, g) => {
        const lhs = flatMap(g)(flatMap(f)(m));
        const rhs = flatMap((x: number) => flatMap(g)(f(x)))(m);
        expect(lhs).toEqual(rhs);
      }),
    );
  });

  it("None is left zero: flatMap(f)(none()) === none()", () => {
    fc.assert(
      fc.property(arbMaybeFn(), (f) => {
        expect(flatMap(f)(none<number>())).toEqual(none<number>());
      }),
    );
  });
});
