import { describe, expect, it } from "bun:test";

import { fluent } from "../src/fluent.js";
import * as core from "../src/maybe.js";

/**
 * Core ↔ fluent surface contract. Rows declare which core transforms the
 * fluent wrapper mirrors; the reverse guard fails when fluent grows an
 * undeclared member. Constructors (some/none/fromNullable/optional),
 * guards (isSome/isNone), array ops (compact/compactMap) and the
 * assertion-tier unwrap are deliberately core-only.
 */
const TABLE = [
  { label: "map", core: "map", fluent: ["map"] },
  { label: "flatMap", core: "flatMap", fluent: ["flatMap", "andThen"] },
  { label: "tap", core: "tap", fluent: ["tap"] },
  { label: "tapNone", core: "tapNone", fluent: ["tapNone"] },
  { label: "match", core: "match", fluent: ["match"] },
  { label: "unwrapOr", core: "unwrapOr", fluent: ["unwrapOr"] },
] as const;

const sample = fluent(core.some(1));

describe("parity: every declared op exists on both surfaces", () => {
  it.each(TABLE.map((row) => [row.label, row] as const))("%s", (_label, row) => {
    expect(typeof (core as Record<string, unknown>)[row.core]).toBe("function");
    for (const name of row.fluent)
      expect(typeof (sample as unknown as Record<string, unknown>)[name]).toBe("function");
  });
});

describe("parity: no undeclared fluent members (reverse drift guard)", () => {
  it("fluent surface is fully declared", () => {
    const allowed = new Set<string>(TABLE.flatMap((row) => [...row.fluent]));
    const actual = Object.keys(sample).filter((k) => k !== "maybe");
    expect(actual.filter((k) => !allowed.has(k)).sort()).toEqual([]);
  });
});

describe("parity: alias pairs agree on a sample", () => {
  it("fluent andThen ≡ core flatMap", () => {
    const half = (n: number) => (n % 2 === 0 ? core.some(n / 2) : core.none());
    expect(fluent(core.some(4)).andThen(half).maybe).toEqual(core.flatMap(core.some(4), half));
  });
});
