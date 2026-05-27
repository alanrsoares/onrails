import { describe, expect, it } from "bun:test";
import { fluent } from "../src/fluent.js";
import { none, some } from "../src/maybe.js";

describe("fluent Maybe", () => {
  it("chains map, andThen, and match", () => {
    const out = fluent(some(2))
      .map((n) => n * 2)
      .andThen((n) => some(String(n)))
      .match(
        (v) => v,
        () => "",
      );
    expect(out).toBe("4");
  });

  it("unwrapOr on None", () => {
    expect(fluent(none<number>()).unwrapOr(9)).toBe(9);
  });
});
