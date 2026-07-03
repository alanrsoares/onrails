import { describe, expect, it } from "bun:test";

import * as barrel from "../src/index.js";

/**
 * The public seam consumers get. Sorted snapshot = reviewable contract;
 * type-only exports are guarded by test/types.spec.ts instead.
 */
const PUBLIC_RUNTIME_EXPORTS = [
  "andThen",
  "compact",
  "compactMap",
  "flatMap",
  "fromNullable",
  "isNone",
  "isSome",
  "map",
  "match",
  "none",
  "optional",
  "some",
  "tap",
  "tapNone",
  "unwrap",
  "unwrapOr",
] as const;

describe("public barrel (src/index.ts)", () => {
  it("exports exactly the declared runtime surface", () => {
    expect(Object.keys(barrel).sort()).toEqual([...PUBLIC_RUNTIME_EXPORTS]);
  });

  it("every export is usable (no dangling re-export)", () => {
    for (const name of PUBLIC_RUNTIME_EXPORTS) {
      expect((barrel as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});
