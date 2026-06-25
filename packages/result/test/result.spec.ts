import { describe, expect, it } from "bun:test";
import { combine, combineTuple } from "../src/collections.js";
import {
  err,
  flatMap,
  map,
  mapErr,
  match,
  ok,
  recover,
  tap,
  tapErr,
  trySync,
  unwrap,
  unwrapErr,
  unwrapOk,
  unwrapOr,
} from "../src/result.js";

describe("sync Result: constructors & transforms", () => {
  it("ok / err tags", () => {
    expect(ok(1)._tag).toBe("Ok");
    expect(err("error")._tag).toBe("Err");
  });

  it("map only transforms Ok", () => {
    expect(map(ok(1), (x) => x + 1)).toEqual(ok(2));
    expect(map((x: number) => x + 1)(ok(1))).toEqual(ok(2));
    expect(map(err("error"), (x: number) => x + 1)).toEqual(err("error"));
  });

  it("flatMap short-circuits on Err", () => {
    expect(flatMap(ok(1), (x) => ok(x + 1))).toEqual(ok(2));
    expect(flatMap(err("error"), (x) => ok(x + 1))).toEqual(err("error"));
  });

  it("flatMap widens and short-circuits errors", () => {
    const f = (x: number) => (x > 0 ? ok(x) : err("negative" as const));
    expect(flatMap(ok(1), f)).toEqual(ok(1));
    expect(flatMap(ok(0), f)).toEqual(err("negative"));
  });
});

describe("sync Result: match", () => {
  it("match dispatches", () => {
    const run = match(
      (x) => `ok:${x}`,
      (e) => `err:${e}`,
    );
    expect(run(ok(1))).toBe("ok:1");
    expect(run(err("x"))).toBe("err:x");
  });
});

describe("sync Result: unwrap", () => {
  it("unwrapOr supplies default on Err", () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err("x"), 0)).toBe(0);
    // Curried
    expect(unwrapOr(0)(ok(5))).toBe(5);
    expect(unwrapOr(0)(err("x"))).toBe(0);
  });

  it("unwrapOk returns Ok value and throws Err value", () => {
    expect(unwrapOk(ok(5))).toBe(5);
    const error = new Error("nope");
    expect(() => unwrapOk(err(error))).toThrow(error);
  });

  it("unwrap alias works identically to unwrapOk", () => {
    expect(unwrap(ok(5))).toBe(5);
    const error = new Error("nope");
    expect(() => unwrap(err(error))).toThrow(error);
  });

  it("unwrapErr returns Err value and throws on Ok", () => {
    expect(unwrapErr(err("x"))).toBe("x");
    expect(() => unwrapErr(ok(5))).toThrow(TypeError);
  });
});

describe("sync Result: trySync & combine", () => {
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
});

describe("sync Result: mapErr & recover", () => {
  it("mapErr maps Err only", () => {
    expect(mapErr((s: string) => s.length)(err("ab"))).toEqual(err(2));
    expect(mapErr((s: string) => s.length)(ok(1))).toEqual(ok(1));
  });

  it("recover can return failed values to the success track", () => {
    expect(recover(err("missing"), () => ok(0))).toEqual(ok(0));
    expect(recover((error: string) => err(error.length))(err("bad"))).toEqual(err(3));
    expect(recover(ok(1), () => err("never"))).toEqual(ok(1));
  });

  it("tap helpers observe only their matching track", () => {
    const seen: string[] = [];
    expect(tap(ok(1), (value) => seen.push(`ok:${value}`))).toEqual(ok(1));
    expect(tapErr(err("bad"), (error) => seen.push(`err:${error}`))).toEqual(err("bad"));
    expect(tap((value: number) => seen.push(`curried:${value}`))(ok(2))).toEqual(ok(2));
    expect(tapErr((error: string) => seen.push(`curried-err:${error}`))(err("no"))).toEqual(
      err("no"),
    );
    expect(seen).toEqual(["ok:1", "err:bad", "curried:2", "curried-err:no"]);
  });
});
