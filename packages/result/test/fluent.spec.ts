import { describe, expect, it } from "bun:test";
import { okAsync } from "../src/async-lift.js";
import { fluent, fluentAsync } from "../src/fluent.js";
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

  it("async fluent matches", async () => {
    const out = await fluentAsync(okAsync(1))
      .map((n) => n + 1)
      .match(
        (n) => n,
        () => 0,
      );
    expect(out).toBe(2);
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
