import { describe, expect, it } from "bun:test";
import { err, map as mapResult, ok, type Result } from "@onrails/result";
import * as fc from "fast-check";
import { fromResult, toResult } from "../src/interop.js";
import { map as mapMaybe } from "../src/maybe.js";
import { arbFn, arbMaybe } from "./helpers/arbitraries.js";

const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

// Suite D: laws relating Maybe and Result across the interop bridge.
describe("Maybe <-> Result interop laws", () => {
  it("fromResult . toResult is the identity on Maybe", () => {
    fc.assert(
      fc.property(arbMaybe, fc.string(), (m, e) => {
        expect(fromResult(toResult(m, () => e))).toEqual(m);
      }),
    );
  });

  it("toResult . fromResult keeps Ok and replaces any Err with the None error", () => {
    fc.assert(
      fc.property(arbResult, fc.string(), (r, e) => {
        const expected = r._tag === "Ok" ? r : err<number, string>(e);
        expect(toResult(fromResult(r), () => e)).toEqual(expected);
      }),
    );
  });

  it("toResult is natural: toResult(map(m, f), g) equals map(toResult(m, g), f)", () => {
    fc.assert(
      fc.property(arbMaybe, arbFn, fc.string(), (m, f, e) => {
        expect(toResult(mapMaybe(m, f), () => e)).toEqual(
          mapResult(
            toResult(m, () => e),
            f,
          ),
        );
      }),
    );
  });

  it("fromResult is natural: fromResult(map(r, f)) equals map(fromResult(r), f)", () => {
    fc.assert(
      fc.property(arbResult, arbFn, (r, f) => {
        expect(fromResult(mapResult(r, f))).toEqual(mapMaybe(fromResult(r), f));
      }),
    );
  });
});
