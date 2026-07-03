import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { asyncAfter, fromResult } from "../src/async-lift.js";
import {
  bimap,
  err,
  flatMap,
  map,
  mapErr,
  match,
  ok,
  recover,
  tap,
  tapErr,
  unwrapOr,
} from "../src/result.js";
import type { Result } from "../src/types.js";

const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

const arbIntFn: fc.Arbitrary<(n: number) => number> = fc.func(fc.integer()) as fc.Arbitrary<
  (n: number) => number
>;

const arbStrToIntFn: fc.Arbitrary<(s: string) => number> = fc.func(fc.integer()) as fc.Arbitrary<
  (s: string) => number
>;

const arbStrFn: fc.Arbitrary<(e: string) => string> = fc.func(fc.string()) as fc.Arbitrary<
  (e: string) => string
>;

const arbResultFn: fc.Arbitrary<(n: number) => Result<number, string>> = fc.func(
  arbResult,
) as fc.Arbitrary<(n: number) => Result<number, string>>;

const arbRecoverFn: fc.Arbitrary<(e: string) => Result<number, string>> = fc.func(
  arbResult,
) as fc.Arbitrary<(e: string) => Result<number, string>>;

/** One row per dual-form transform: data-first and curried must agree. */
// bun:test's `it.each` overloads require a mutable array table.
const cases: Array<{ label: string; assert: () => void }> = [
  {
    label: "map",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbIntFn, (r, f) => {
          expect(map(r, f)).toEqual(map(f)(r));
        }),
      ),
  },
  {
    label: "mapErr",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbStrFn, (r, f) => {
          expect(mapErr(r, f)).toEqual(mapErr(f)(r));
        }),
      ),
  },
  {
    label: "bimap",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbIntFn, arbStrFn, (r, f, g) => {
          expect(bimap(r, f, g)).toEqual(bimap(f, g)(r));
        }),
      ),
  },
  {
    label: "flatMap",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbResultFn, (r, f) => {
          expect(flatMap(r, f)).toEqual(flatMap(f)(r));
        }),
      ),
  },
  {
    label: "recover",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbRecoverFn, (r, f) => {
          expect(recover(r, f)).toEqual(recover(f)(r));
        }),
      ),
  },
  {
    label: "tap",
    assert: () =>
      fc.assert(
        fc.property(arbResult, (r) => {
          const seenFirst: number[] = [];
          const seenCurried: number[] = [];
          const dataFirst = tap(r, (v) => {
            seenFirst.push(v);
          });
          const curried = tap((v: number) => {
            seenCurried.push(v);
          })(r);
          expect({ result: dataFirst, seen: seenFirst }).toEqual({
            result: curried,
            seen: seenCurried,
          });
        }),
      ),
  },
  {
    label: "tapErr",
    assert: () =>
      fc.assert(
        fc.property(arbResult, (r) => {
          const seenFirst: string[] = [];
          const seenCurried: string[] = [];
          const dataFirst = tapErr(r, (e) => {
            seenFirst.push(e);
          });
          const curried = tapErr((e: string) => {
            seenCurried.push(e);
          })(r);
          expect({ result: dataFirst, seen: seenFirst }).toEqual({
            result: curried,
            seen: seenCurried,
          });
        }),
      ),
  },
  {
    label: "match",
    assert: () =>
      fc.assert(
        fc.property(arbResult, arbIntFn, arbStrToIntFn, (r, onOk, onErr) => {
          expect(match(r, onOk, onErr)).toEqual(match(onOk, onErr)(r));
        }),
      ),
  },
  {
    label: "unwrapOr",
    assert: () =>
      fc.assert(
        fc.property(arbResult, fc.integer(), (r, fallback) => {
          expect(unwrapOr(r, fallback)).toEqual(unwrapOr(fallback)(r));
        }),
      ),
  },
];

describe("dual-form equivalence (property-based)", () => {
  it.each(cases)("$label: data-first === curried", ({ assert }) => {
    assert();
  });

  it("asyncAfter: data-first === curried", async () => {
    await fc.assert(
      fc.asyncProperty(arbResult, arbResultFn, async (r, f) => {
        const step = (n: number) => fromResult(f(n));
        const dataFirst = await asyncAfter(r, step).resolve();
        const curried = await asyncAfter(step)(r).resolve();
        expect(dataFirst).toEqual(curried);
      }),
    );
  });
});
