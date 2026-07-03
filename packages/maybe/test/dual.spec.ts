import { describe, expect, it } from "bun:test";
import { err, ok, type Result } from "@onrails/result";
import * as fc from "fast-check";
import { fromResult, nullableToResult, toResult } from "../src/interop.js";
import {
  flatMap,
  type Maybe,
  map,
  match,
  none,
  some,
  tap,
  tapNone,
  unwrapOr,
} from "../src/maybe.js";

// Reused across cases: property is data-first(...args) deep-equal curried(...)(m).

const arbMaybe: fc.Arbitrary<Maybe<number>> = fc.oneof(
  fc.integer().map((n) => some(n)),
  fc.constant(none<number>()),
);

const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

const arbIntFn = (): fc.Arbitrary<(n: number) => number> =>
  fc.func(fc.integer()) as fc.Arbitrary<(n: number) => number>;

const arbMaybeFn = (): fc.Arbitrary<(n: number) => Maybe<number>> =>
  fc.func(arbMaybe) as fc.Arbitrary<(n: number) => Maybe<number>>;

describe("dual-form equivalence: data-first === curried (maybe.ts)", () => {
  it("map", () => {
    fc.assert(
      fc.property(arbMaybe, arbIntFn(), (m, f) => {
        expect(map(m, f)).toEqual(map(f)(m));
      }),
    );
  });

  it("flatMap", () => {
    fc.assert(
      fc.property(arbMaybe, arbMaybeFn(), (m, f) => {
        expect(flatMap(m, f)).toEqual(flatMap(f)(m));
      }),
    );
  });

  it("match", () => {
    fc.assert(
      fc.property(arbMaybe, arbIntFn(), fc.integer(), (m, onSome, fallback) => {
        const onNone = () => fallback;
        expect(match(m, onSome, onNone)).toEqual(match(onSome, onNone)(m));
      }),
    );
  });

  it("unwrapOr", () => {
    fc.assert(
      fc.property(arbMaybe, fc.integer(), (m, fallback) => {
        expect(unwrapOr(m, fallback)).toEqual(unwrapOr(fallback)(m));
      }),
    );
  });

  it("tap", () => {
    fc.assert(
      fc.property(arbMaybe, (m) => {
        expect(tap(m, () => {})).toEqual(tap<number>(() => {})(m));
      }),
    );
  });

  it("tapNone", () => {
    fc.assert(
      fc.property(arbMaybe, (m) => {
        expect(tapNone(m, () => {})).toEqual(tapNone<number>(() => {})(m));
      }),
    );
  });
});

describe("dual-form equivalence: data-first === curried (interop.ts)", () => {
  it("toResult", () => {
    fc.assert(
      fc.property(arbMaybe, fc.string(), (m, errValue) => {
        const onNone = () => errValue;
        expect(toResult(m, onNone)).toEqual(toResult(onNone)(m));
      }),
    );
  });

  it("fromResult", () => {
    fc.assert(
      fc.property(arbResult, (r) => {
        expect(fromResult(r)).toEqual(fromResult<number, string>()(r));
      }),
    );
  });

  it("nullableToResult", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.constant(null), fc.constant(undefined)),
        fc.string(),
        (value, errValue) => {
          const onNone = () => errValue;
          expect(nullableToResult(value, onNone)).toEqual(nullableToResult(onNone)(value));
        },
      ),
    );
  });
});
