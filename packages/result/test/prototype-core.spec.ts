import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import {
  err,
  flatMap,
  map,
  mapErr,
  match,
  ok,
  Result,
  type ResultData,
  recover,
  tap,
  tapErr,
  unwrapOr,
} from "../src/index.js";
import { arbErrFn, arbFn, arbResult } from "./helpers/arbitraries.js";

const METHODS = [
  "map",
  "mapErr",
  "flatMap",
  "andThen",
  "recover",
  "tap",
  "tapErr",
  "match",
  "unwrapOr",
] as const;

const toData = <T, E>(r: Result<T, E>): ResultData<T, E> =>
  r._tag === "Ok" ? { _tag: "Ok", value: r.value } : { _tag: "Err", error: r.error };

describe("prototype core: shape", () => {
  it("own enumerable keys are only the tag and the payload", () => {
    expect(Object.keys(ok(1))).toEqual(["_tag", "value"]);
    expect(Object.keys(err("e"))).toEqual(["_tag", "error"]);
  });

  it.each(METHODS.map((name) => ({ name })))(
    "$name is on the prototype, not enumerable",
    ({ name }) => {
      const r = ok(1);
      expect(typeof r[name]).toBe("function");
      expect(Object.hasOwn(r, name)).toBe(false);
      expect(Object.keys(r)).not.toContain(name);
      const seen: string[] = [];
      for (const k in r) seen.push(k);
      expect(seen).toEqual(["_tag", "value"]);
    },
  );

  it("JSON output is exactly the plain-data shape", () => {
    expect(JSON.stringify(ok({ a: 1 }))).toBe('{"_tag":"Ok","value":{"a":1}}');
    expect(JSON.stringify(err("x"))).toBe('{"_tag":"Err","error":"x"}');
  });
});

describe("prototype core: methods agree with the module functions", () => {
  const same = <T, E>(a: Result<T, E>, b: Result<T, E>) => expect(toData(a)).toEqual(toData(b));

  it("map / mapErr / flatMap / andThen / recover", () => {
    fc.assert(
      fc.property(arbResult, arbFn, arbErrFn, (r, f, g) => {
        same(r.map(f), map(r, f));
        same(r.mapErr(g), mapErr(r, g));
        same(
          r.flatMap((n) => ok<number, string>(f(n))),
          flatMap(r, (n) => ok<number, string>(f(n))),
        );
        same(
          r.andThen((n) => err<number, string>(g(String(n)))),
          flatMap(r, (n) => err<number, string>(g(String(n)))),
        );
        same(
          r.recover((e) => ok<number, string>(g(e).length)),
          recover(r, (e) => ok<number, string>(g(e).length)),
        );
      }),
    );
  });

  it("match / unwrapOr", () => {
    fc.assert(
      fc.property(arbResult, arbFn, (r, f) => {
        expect(r.match(f, (e) => e.length)).toBe(match(r, f, (e) => e.length));
        expect(r.unwrapOr(-1)).toBe(unwrapOr(r, -1));
      }),
    );
  });

  it("tap and tapErr observe one track, return the same carrier, and do not swallow throws", () => {
    const seen: unknown[] = [];
    const okR = ok<number, string>(1);
    expect(okR.tap((n) => seen.push(n))).toBe(okR);
    expect(okR.tapErr((e) => seen.push(e))).toBe(okR);
    expect(tap(okR, (n) => seen.push(n))).toBe(okR);
    expect(tapErr(okR, (e) => seen.push(e))).toBe(okR);
    expect(seen).toEqual([1, 1]);
    expect(() =>
      ok(1).tap(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });

  it("chains read left to right", () => {
    const out = ok<number, string>(2)
      .map((n) => n * 3)
      .flatMap((n) => (n > 5 ? ok<string, string>(`big:${n}`) : err<string, string>("small")))
      .match(
        (s) => s,
        (e) => e,
      );
    expect(out).toBe("big:6");
  });
});

describe("prototype core: serialization boundary", () => {
  it("structuredClone and JSON drop the methods but keep the data", () => {
    fc.assert(
      fc.property(arbResult, (r) => {
        for (const wire of [structuredClone(r), JSON.parse(JSON.stringify(r))]) {
          expect(Object.getPrototypeOf(wire)).toBe(Object.prototype);
          expect(typeof wire.map).toBe("undefined");
          expect(wire).toEqual(toData(r));
        }
      }),
    );
  });

  it("object spread drops the methods too", () => {
    expect(typeof ({ ...ok(1) } as { map?: unknown }).map).toBe("undefined");
  });

  it("Result.from restores a working carrier from every plain-data route", () => {
    fc.assert(
      fc.property(arbResult, arbFn, (r, f) => {
        for (const wire of [structuredClone(r), JSON.parse(JSON.stringify(r)), { ...r }]) {
          const live = Result.from<number, string>(wire);
          expect(live).toEqual(r);
          expect(toData(live.map(f))).toEqual(toData(map(r, f)));
        }
      }),
    );
  });

  it("Result.from accepts an already-live carrier", () => {
    expect(toData(Result.from(ok(1)))).toEqual({ _tag: "Ok", value: 1 });
  });

  it("a hand-written literal is not a Result", () => {
    // @ts-expect-error a literal has no methods; build with ok() or lift with Result.from
    const bad: Result<number, string> = { _tag: "Ok", value: 1 };
    expect(typeof bad.map).toBe("undefined");
  });
});
