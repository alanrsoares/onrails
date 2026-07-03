import { describe, expect, it } from "bun:test";

import * as barrel from "../src/index.js";

/**
 * The public seam consumers get. This sorted snapshot is the reviewable
 * contract — an export added or removed without touching this list fails CI
 * instead of shipping silently. Type-only exports have no runtime key and
 * are guarded by test/types.spec.ts instead.
 */
const PUBLIC_RUNTIME_EXPORTS = [
  "$",
  "ResultAsync",
  "UnexpectedError",
  "asyncAfter",
  "bimap",
  "combine",
  "combineTuple",
  "err",
  "errAsync",
  "flatMap",
  "flow",
  "fromAsync",
  "fromPromise",
  "fromResult",
  "fromSafePromise",
  "isErr",
  "isOk",
  "map",
  "mapErr",
  "match",
  "ok",
  "okAsync",
  "pipe",
  "recover",
  "tap",
  "tapErr",
  "tryAsync",
  "tryGen",
  "trySync",
  "unwrap",
  "unwrapErr",
  "unwrapOk",
  "unwrapOr",
  "validateAll",
  "validateTuple",
  "yieldResult",
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
