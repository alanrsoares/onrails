import { describe, expect, it } from "bun:test";

import { ResultAsync } from "../src/async.js";
import { fluent } from "../src/fluent.js";
import { err, isOk, of, ok, show } from "../src/result.js";

describe("of — FL pure", () => {
  it("is the ok constructor", () => {
    expect(of).toBe(ok);
    expect(of(42)).toEqual(ok(42));
  });

  it("ResultAsync.of resolves to Ok", async () => {
    const r = await ResultAsync.of(42).resolve();
    expect(isOk(r) && r.value).toBe(42);
  });
});

describe("show — debug printer", () => {
  it.each<{ label: string; input: Parameters<typeof show>[0]; expected: string }>([
    { label: "Ok primitive", input: ok(1), expected: "Ok(1)" },
    { label: "Err object", input: err({ kind: "e" }), expected: 'Err({"kind":"e"})' },
    { label: "Ok string", input: ok("x"), expected: 'Ok("x")' },
    { label: "Ok undefined", input: ok(undefined), expected: "Ok(undefined)" },
  ])("$label", ({ input, expected }) => {
    expect(show(input)).toBe(expected);
  });

  it("falls back to String() on non-JSON payloads instead of throwing", () => {
    type Cyclic = { self?: unknown };
    const cyclic: Cyclic = {};
    cyclic.self = cyclic;
    expect(show(ok(cyclic))).toBe("Ok([object Object])");
  });
});

describe("fluent terminals", () => {
  it("toResult exits the bracket with the same plain data", () => {
    const r = ok<number, string>(1);
    expect(fluent(r).toResult()).toBe(r);
    expect(
      fluent(r)
        .map((n) => n + 1)
        .toResult(),
    ).toEqual(ok(2));
  });

  it("toString matches show", () => {
    const r = err<number, { kind: string }>({ kind: "boom" });
    expect(fluent(r).toString()).toBe(show(r));
  });
});
