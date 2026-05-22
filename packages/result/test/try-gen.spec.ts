import { describe, expect, it } from "bun:test";
import { err, ok } from "../src/result.js";
import { $, tryGen, yieldResult } from "../src/try-gen.js";

describe("tryGen", () => {
  it("short-circuits on first Err", () => {
    const out = tryGen(() => {
      yieldResult(err<number, string>("a"));
      return ok<number, string>(99);
    });
    expect(out).toEqual(err<number, string>("a"));
  });

  it("returns final Ok", () => {
    const out = tryGen(() => {
      const n = yieldResult(ok(2));
      return ok(n * 3);
    });
    expect(out).toEqual(ok(6));
  });

  it("$ aliases yieldResult", () => {
    const out = tryGen(() => {
      const n = $(ok(2));
      return ok(n * 3);
    });
    expect(out).toEqual(ok(6));
  });
});
