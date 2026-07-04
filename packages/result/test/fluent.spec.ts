import { describe, expect, it } from "bun:test";
import { fluent } from "../src/fluent.js";
import { err, ok } from "../src/result.js";

describe("fluent", () => {
  it("chains sync operations", () => {
    const out = fluent(ok(2))
      .map((n) => n * 3)
      .andThen((n) => ok(String(n)))
      .match(
        (s) => s,
        () => "err",
      );
    expect(out).toBe("6");
  });
});

describe("fluent Err path", () => {
  it("short-circuits", () => {
    const out = fluent(err("e"))
      .map((s: string) => s.length)
      .match(
        (n) => n,
        () => -1,
      );
    expect(out).toBe(-1);
  });
});
