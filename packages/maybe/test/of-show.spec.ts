import { describe, expect, it } from "bun:test";

import { fluent } from "../src/fluent.js";
import { none, of, show, some } from "../src/maybe.js";

describe("of — FL pure", () => {
  it("is the some constructor", () => {
    expect(of).toBe(some);
    expect(of(42)).toEqual(some(42));
  });
});

describe("show — debug printer", () => {
  it.each<{ label: string; input: Parameters<typeof show>[0]; expected: string }>([
    { label: "Some primitive", input: some(1), expected: "Some(1)" },
    { label: "Some object", input: some({ id: "x" }), expected: 'Some({"id":"x"})' },
    { label: "Some undefined", input: some(undefined), expected: "Some(undefined)" },
    { label: "None", input: none(), expected: "None" },
  ])("$label", ({ input, expected }) => {
    expect(show(input)).toBe(expected);
  });

  it("falls back to String() on non-JSON payloads instead of throwing", () => {
    type Cyclic = { self?: unknown };
    const cyclic: Cyclic = {};
    cyclic.self = cyclic;
    expect(show(some(cyclic))).toBe("Some([object Object])");
  });
});

describe("fluent terminals", () => {
  it("toMaybe exits the bracket with the same plain data", () => {
    const m = some(1);
    expect(fluent(m).toMaybe()).toBe(m);
    expect(
      fluent(m)
        .map((n) => n + 1)
        .toMaybe(),
    ).toEqual(some(2));
  });

  it("toString matches show", () => {
    expect(fluent(none()).toString()).toBe(show(none()));
    expect(fluent(some(3)).toString()).toBe(show(some(3)));
  });
});
