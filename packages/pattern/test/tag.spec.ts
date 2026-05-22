import { describe, expect, it } from "bun:test";
import { err, ok, type Result } from "@onrails/result";
import { matchTag } from "../src/tag.js";

describe("matchTag", () => {
  it("dispatches on _tag", () => {
    const label = (r: Result<number, string>) =>
      matchTag(r, {
        Ok: (v) => `ok:${v.value}`,
        Err: (e) => `err:${e.error}`,
      });
    expect(label(ok(1))).toBe("ok:1");
    expect(label(err("x"))).toBe("err:x");
  });
});
