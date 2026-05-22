import { describe, expect, it } from "bun:test";
import {
  andThen,
  combine,
  combineTuple,
  err,
  flatMap,
  map,
  mapErr,
  match,
  matchResult,
  ok,
  trySync,
  unwrapErr,
  unwrapOk,
  unwrapOr,
} from "../src/result.js";

describe("sync Result", () => {
  it("ok / err tags", () => {
    expect(ok(1)).toEqual({ _tag: "Ok", value: 1 });
    expect(err("x")).toEqual({ _tag: "Err", error: "x" });
  });

  it("map only transforms Ok", () => {
    expect(map((n: number) => n * 2)(ok(2))).toEqual(ok(4));
    expect(map((n: number) => n * 2)(err("e"))).toEqual(err("e"));
  });

  it("flatMap short-circuits on Err", () => {
    const doubled = flatMap((n: number) => (n > 0 ? ok(n * 2) : err("non-positive")));
    expect(doubled(ok(3))).toEqual(ok(6));
    expect(doubled(ok(-1))).toEqual(err("non-positive"));
    expect(doubled(err("skip"))).toEqual(err("skip"));
  });

  it("andThen is flatMap", () => {
    expect(andThen((n: number) => ok(String(n)))(ok(7))).toEqual(ok("7"));
  });

  it("match dispatches", () => {
    expect(
      match(
        ok(1),
        (n) => `ok:${n}`,
        (e) => `err:${e}`,
      ),
    ).toBe("ok:1");
    expect(
      match(
        err(0),
        (n) => `ok:${n}`,
        (e) => `err:${e}`,
      ),
    ).toBe("err:0");
  });

  it("matchResult is an alias for match", () => {
    expect(
      matchResult(
        ok(1),
        (n) => `ok:${n}`,
        (e) => `err:${e}`,
      ),
    ).toBe("ok:1");
  });

  it("unwrapOr supplies default on Err", () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err("x"), 0)).toBe(0);
  });

  it("unwrapOk returns Ok value and throws Err value", () => {
    expect(unwrapOk(ok(5))).toBe(5);
    const error = new Error("nope");
    expect(() => unwrapOk(err(error))).toThrow(error);
  });

  it("unwrapErr returns Err value and throws on Ok", () => {
    expect(unwrapErr(err("x"))).toBe("x");
    expect(() => unwrapErr(ok(5))).toThrow(TypeError);
  });

  it("trySync catches throws", () => {
    const parse = trySync(
      (raw: string) => JSON.parse(raw) as { v: number },
      (e) => ({ message: String(e) }),
    );
    expect(parse('{"v":1}')).toEqual(ok({ v: 1 }));
    expect(parse("not-json")._tag).toBe("Err");
  });

  it("combine collects or returns first Err", () => {
    expect(combine([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(combine([ok(1), err("e")])).toEqual(err("e"));
  });

  it("combineTuple preserves tuple types at runtime", () => {
    const combined = combineTuple([ok(1), ok("a")] as const);
    expect(combined).toEqual(ok([1, "a"]));
  });

  it("mapErr maps Err only", () => {
    expect(mapErr((s: string) => s.length)(err("ab"))).toEqual(err(2));
    expect(mapErr((s: string) => s.length)(ok(1))).toEqual(ok(1));
  });
});
