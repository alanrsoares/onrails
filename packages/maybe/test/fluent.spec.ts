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

  it("tap / tapNone run effects and stay chainable", () => {
    const log: string[] = [];
    const out = fluent(some(2))
      .tap((n) => log.push(`some:${n}`))
      .tapNone(() => log.push("none"))
      .map((n) => n + 1)
      .unwrapOr(0);
    expect(out).toBe(3);
    expect(log).toEqual(["some:2"]);
  });
});
