import { describe, expect, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { err, ok, type Result } from "../src/compat/neverthrow.js";

describe("compat isOk / isErr type guards", () => {
  it("isOk narrows and exposes value", () => {
    const r: Result<number, string> = ok(1);
    if (r.isOk()) {
      expectType<TypeEqual<typeof r.value, number>>(true);
      expect(r.value).toBe(1);
    }
  });

  it("isErr narrows and exposes error", () => {
    const r: Result<number, string> = err("boom");
    if (r.isErr()) {
      expectType<TypeEqual<typeof r.error, string>>(true);
      expect(r.error).toBe("boom");
    }
  });

  it("value and error are hidden until narrowed", () => {
    // type-level only: the arrow is never invoked, the getters would throw
    const _typeOnly = (r: Result<number, string>): void => {
      // @ts-expect-error value is only reachable after isOk() narrows, matching neverthrow
      r.value;
      // @ts-expect-error error is only reachable after isErr() narrows, matching neverthrow
      r.error;
    };
    expect(_typeOnly).toBeDefined();
  });
});
