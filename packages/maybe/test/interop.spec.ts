import { describe, expect, it } from "bun:test";
import { err, ok } from "@onrails/result";
import { fromResult, isNoneError, noneError, nullableToResult, toResult } from "../src/interop.js";
import { fromNullable, some } from "../src/maybe.js";

describe("Maybe interop", () => {
  it("toResult maps None to error", () => {
    const r = toResult(fromNullable(null), () => ({ kind: "missing" as const }));
    expect(r._tag).toBe("Err");
    if (r._tag === "Err") {
      expect(r.error).toEqual({ kind: "missing" });
    }

    // Curried
    const toMissing = toResult(() => ({ kind: "missing" as const }));
    const r2 = toMissing(fromNullable(null));
    expect(r2._tag).toBe("Err");
    if (r2._tag === "Err") {
      expect(r2.error).toEqual({ kind: "missing" });
    }
    expect(toMissing(some(1))).toEqual(ok(1));
  });

  it("fromResult keeps only Ok", () => {
    expect(fromResult(ok(1))).toEqual(some(1));
    expect(fromResult(err("fail"))._tag).toBe("None");

    // Curried
    const fromRes = fromResult();
    expect(fromRes(ok(1))).toEqual(some(1));
    expect(fromRes(err("fail"))._tag).toBe("None");
  });

  it("nullableToResult", () => {
    expect(nullableToResult("x", noneError)._tag).toBe("Ok");
    expect(nullableToResult(null, noneError)._tag).toBe("Err");

    // Curried
    const toNoneErr = nullableToResult(noneError);
    expect(toNoneErr("x")._tag).toBe("Ok");
    expect(toNoneErr(null)._tag).toBe("Err");
  });

  it("isNoneError", () => {
    expect(isNoneError(err(noneError()))).toBe(true);
    expect(isNoneError(err("other"))).toBe(false);
  });
});
